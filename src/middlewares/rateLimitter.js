const rateLimit = require("express-rate-limit");
const ApiError = require("../utils/ApiError.js");

// Define rate limiter: 1 request per 10 minutes, limited by email
const resetPasswordLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1, // 1 request per window per email
  message: {
    status: 429,
    message:
      "Too many password reset requests. Please try again after 10 minutes.",
  },
  standardHeaders: true, // Send rate limit info in the headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email; // Return email as the rate-limiting key
  },
  handler: (req, res) => {
    // Custom handler when rate limit is exceeded
    res
      .status(429)
      .json(
        new ApiError(
          429,
          "Too many password reset requests for this email. Please try again after 10 minutes."
        )
      );
  },
});

export default resetPasswordLimiter;
