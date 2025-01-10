const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const ApiError = require("../utils/ApiError");
require("dotenv").config();

// Middleware to check JWT in cookies
const authMiddleware = (req, res, next) => {
  const token = req.cookies?.authToken;
  if (!token)
    return res.status(401).json(new ApiError(401, "User not logged in."));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;

    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid token" });
  }
};

// Function to generate and set JWT token in cookies
const generateToken = (payload, res) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "6h",
  });

  // Set the token in cookies
  res.cookie("authToken", token, {
    httpOnly: true, // Prevent client-side access
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 21600000,
  });

  return token;
};

module.exports = { authMiddleware, generateToken };
