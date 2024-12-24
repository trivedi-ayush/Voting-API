const ApiError = require("../utils/ApiError.js")

const noQueryParamsAllowed = (req, res, next) => {
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json(new ApiError(400, "Query parameters are not allowed for this endpoint"));
    }
    next();
  };
  
  module.exports = noQueryParamsAllowed;
  