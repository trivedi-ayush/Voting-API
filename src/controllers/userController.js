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

const register = async (req, res) => {
  try {
    const data = req.body;

    const [existingUser, existingAdmin] = await Promise.all([
      User.findOne({
        $or: [
          { aadharCardNumber: data.aadharCardNumber },
          { email: data.email },
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
            "User with the same Aadhar Card Number  or email already exists"
          )
        );
    }

    if (existingAdmin && data.role == "admin") {
      console.log("existingAdmin", existingAdmin);
      return res.status(400).json(new ApiError(400, "Admin already exists"));
    }

    const newUser = new User(data);

    const response = await newUser.save();

    res
      .status(200)
      .json(new ApiResponse(201, "User Registered Successfully", response));
  } catch (error) {
    console.log(error);
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
    res.cookie("authToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
    });

    return res.status(200).json(new ApiResponse(200, "Logout successful"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(new ApiError(500, error.message));
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }
    res
      .status(200)
      .json(new ApiResponse(200, "User Fetched Successfully", user));
  } catch (err) {
    console.error(err);
    res.status(500).json(new ApiError(500, err.message));
  }
};

const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id; // Extract the id from the token
    const { currentPassword, newPassword } = req.body; // Extract current and new passwords from request body

    // Check if currentPassword and newPassword are present in the request body
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Both currentPassword and newPassword are required" });
    }

    // Find the user by userID
    const user = await User.findById(userId);

    // If user does not exist or password does not match, return error
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    // Update the user's password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
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
      console.log(emailError);
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

    // Hash the new password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password in the database
    user.password = hashedPassword;
    await user.save();

    // Mark the token as used by setting isUsed to true
    passwordResetEntry.isUsed = true;
    await passwordResetEntry.save();

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
      .json(new ApiResponse(200, "Password reset successful"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }
};

module.exports = {
  register,
  login,
  logout,
  getUserProfile,
  updatePassword,
  requestPasswordReset,
  passwordReset,
};
