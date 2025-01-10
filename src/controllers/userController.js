require("dotenv").config();
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("./../models/user.js");
const { generateToken } = require("../middlewares/jwt.js");
const ApiError = require("../utils/ApiError.js");
const ApiResponse = require("../utils/ApiResponse.js");
const transporter = require("../config/nodemailer.js");
const crypto = require("crypto");
const PasswordReset = require("../models/passwordResetSchema.js");
const bcrypt = require("bcrypt");
const validatePassword = require("../utils/validatePassword.js");
const clearAuthCookie = require("../utils/clearAuthCookie");
const client = require("../config/redis.js");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../middlewares/uploadMiddleware.js");
const { sendNotifications } = require("../config/sendNotifications.js");

const register = async (req, res) => {
  try {
    const data = req.body;

    const [existingUser, existingAdmin] = await Promise.all([
      User.findOne({
        $or: [
          { aadharCardNumber: data.aadharCardNumber },
          { email: data.email },
          { mobile: data.mobile },
        ],
      }),
      User.findOne({
        role: "admin",
      }),
    ]);

    if (existingUser) {
      console.log("existingUser:-", existingUser);
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "User with the same Aadhar Card Number, Mobile number or email already exists."
          )
        );
    }

    if (existingAdmin && data.role == "admin") {
      console.log("existingAdmin", existingAdmin);
      return res.status(400).json(new ApiError(400, "Admin already exists"));
    }

    // Add profile picture URL
    if (req.file) {
      data.profilePictureUrl = req.file.location;
    }

    const newUser = new User(data);

    const response = await newUser.save();

    // Send Notifications (Email and SMS)
    const sms = await sendNotifications(data.mobile, data.name);
    console.log(sms);

    res
      .status(200)
      .json(new ApiResponse(201, "User Registered Successfully", response));
  } catch (error) {
    console.log(error);
    res.status(500).json(new ApiError(500, error.message));
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = req.userId;
    const data = req.body;

    if (data.password || data.isVoted || data.aadharCardNumber) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Password,isVoted and aadharCardNumber cannot be updated."
          )
        );
    }

    if (data.role && data.role == "admin") {
      const existingAdmin = await User.findOne({ role: "admin" });
      if (existingAdmin) {
        return res.status(400).json(new ApiError(400, "Admin already exists."));
      }
    }

    // Check if the user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }

    // Check for conflicts with other users
    if (data.email || data.mobile) {
      const conflictingUser = await User.findOne({
        $or: [{ email: data.email }, { mobile: data.mobile }],
      });
      if (conflictingUser) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              "Another user with the same email already exists."
            )
          );
      }
    }

    // Handle profile picture update
    if (req.file) {
      // Delete old profile picture from S3
      if (existingUser.profilePictureUrl) {
        const oldKey = existingUser.profilePictureUrl.split(".com/")[1]; // Extract the S3 key from the URL

        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: oldKey,
            })
          );
        } catch (err) {
          console.error("Error deleting old profile picture from S3:", err);
          return res
            .status(500)
            .json(new ApiError(500, "Failed to delete old profile picture"));
        }
      }

      // Set new profile picture URL
      data.profilePictureUrl = req.file.location;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, data, {
      new: true,
      runValidators: true,
    });

    res
      .status(200)
      .json(new ApiResponse(200, "User updated successfully", updatedUser));
  } catch (error) {
    console.error(error);
    res.status(500).json(new ApiError(500, error.message));
  }
};

const login = async (req, res) => {
  try {
    const { aadharCardNumber, password } = req.body;

    if (!aadharCardNumber || !password) {
      return res
        .status(400)
        .json(
          new ApiError(400, "Aadhar Card Number and password are required")
        );
    }

    const user = await User.findOne({ aadharCardNumber: aadharCardNumber });
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json(new ApiError(401, "Invalid Aadhar Card Number or Password"));
    }

    const payload = {
      id: user._id,
    };
    const token = generateToken(payload, res);

    return res.json(new ApiResponse(200, "Login Successful", token));
  } catch (err) {
    console.error(err);
    return res.status(500).json(new ApiError(500, err.message));
  }
};

const logout = (req, res) => {
  try {
    clearAuthCookie(res);

    return res.status(200).json(new ApiResponse(200, "Logout successful"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, error.message));
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const cachedUser = await client.get(`user:${userId}`);
    if (cachedUser) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            "User Fetched Successfully",
            JSON.parse(cachedUser)
          )
        );
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }

    //caching
    await client.set(`user:${userId}`, JSON.stringify(user));
    await client.expire(`user:${userId}`, 600);
    res
      .status(200)
      .json(new ApiResponse(200, "User Fetched Successfully", user));
  } catch (err) {
    console.error(err);
    res.status(500).json(new ApiError(500, err.message));
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    const email = user.email;

    //generating random string
    const randomString = crypto.randomBytes(32).toString("hex");

    // Generate JWT token with user ID and expiration (1 hour)
    const resetToken = jwt.sign(
      { _id: user._id, randomString },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    //hashing the token
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Token expiration timestamp (1 hour from now)
    const expiresAt = Date.now() + 3600 * 1000;

    // Create or update the password reset entry
    await PasswordReset.findOneAndUpdate(
      { userId: user._id },
      {
        resetToken: hashedToken,
        expiresAt: new Date(expiresAt),
        isUsed: false,
      },
      { upsert: true }
    );

    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/user/request-password-reset/${resetToken}`;

    // Path to the template file
    const templatePath = path.join(
      __dirname,
      "../templates/passwordResetTemplate.html"
    );

    // Read the HTML file
    let htmlTemplate = fs.readFileSync(templatePath, { encoding: "utf-8" });

    // Replace placeholders with actual data
    htmlTemplate = htmlTemplate
      .replace("[Name]", user.name || "User")
      .replace("[RESET_LINK]", resetUrl);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Password",
      html: htmlTemplate,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      return res
        .status(500)
        .json(
          new ApiError(
            500,
            "Failed to send reset email. Please try again later."
          )
        );
    }

    // Return response
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "A password reset link has been sent to your email if the account exists."
        )
      );
  } catch (error) {
    console.error(error);
    res.status(500).json(new ApiError(500, error.message));
  }
};

const passwordReset = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Validate input
    if (!token || !password) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Both 'token' and 'password' are required to reset your password"
          )
        );
    }

    // Hash the provided token to match the stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Check if a password reset entry exists for this token
    const passwordResetEntry = await PasswordReset.findOne({
      resetToken: hashedToken,
    });
    if (!passwordResetEntry) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Invalid or expired token. Please request a new password reset token"
          )
        );
    }

    // Check if the token has been used
    if (passwordResetEntry.isUsed) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "This token has already been used. Please request a new reset link"
          )
        );
    }

    // Check if the token has expired
    if (Date.now() > new Date(passwordResetEntry.expiresAt)) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "This token has expired. Please request a new reset link"
          )
        );
    }

    // Check if the user exists
    const user = await User.findById(passwordResetEntry.userId);
    if (!user) {
      return res
        .status(404)
        .json(
          new ApiError(404, "The user associated with this token was not found")
        );
    }

    // Ensure new password meets security standards
    const isValidPassword = validatePassword(password);
    if (!isValidPassword) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
          )
        );
    }

    // Ensure the new password is not the same as the old one
    const isSameAsOldPassword = await bcrypt.compare(password, user.password);
    if (isSameAsOldPassword) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            "The new password cannot be the same as your current password."
          )
        );
    }

    // Update the user's password in the database
    user.password = password;
    await user.save();

    // Delete the password reset entry from the database
    await PasswordReset.deleteOne({ resetToken: hashedToken });

    // Clear the auth cookie (logout)
    clearAuthCookie(res);

    // Send confirmation email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Password Reset Successful",
      html: "Password Reset Successful",
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      return res
        .status(500)
        .json(
          new ApiError(
            500,
            "Password reset successful, but failed to send confirmation email."
          )
        );
    }

    // Return success response
    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successful and logged out."));
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }
};

module.exports = {
  register,
  login,
  logout,
  getUserProfile,
  requestPasswordReset,
  passwordReset,
  updateUser,
};
