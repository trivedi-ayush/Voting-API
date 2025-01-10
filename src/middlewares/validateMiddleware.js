const ApiError = require("../utils/ApiError.js");

const validate = (schema) => async (req, res, next) => {
  try {
    const parseBody = await schema.parseAsync(req.body);
    req.body = parseBody;
    next();
  } catch (err) {
    if (err.errors) {
      const detailedErrors = err.errors.map((error) => ({
        field: error.path.join("."),
        message: error.message,
        code: error.code,
        // expected: error.expected,
      }));
      return res.status(400).json(new ApiError(400, detailedErrors));
    }
  }
};

module.exports = validate;
