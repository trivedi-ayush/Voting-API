const multer = require("multer");
const ApiError = require("../utils/ApiError.js");

const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res
        .status(400)
        .json(new ApiError(400, "Only one photo is allowed at a time!"));
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json(new ApiError(400, "File size exceeds the 5MB limit!"));
    }
  }
  next(err); // Pass other errors to the global error handler
};

module.exports = multerErrorHandler;
