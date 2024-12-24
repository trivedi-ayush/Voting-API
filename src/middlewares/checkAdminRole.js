const ApiError = require("../utils/ApiError.js");
const User = require("../models/user.js");
const checkAdminRole = async (req, res, next) => {
  try {
    const id = req.userId;
    const user = await User.findById(id);
    if (!user || user.role !== "admin") {
      return res
        .status(403)
        .json(new ApiError(403, "Only Admin can create candidate"));
    }

    next();
  } catch (err) {
    console.log(err);
    return res.status(500).json(new ApiError(500, err.message));
  }
};

module.exports = checkAdminRole;
