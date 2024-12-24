const mongoose = require("mongoose");

const isValidObjectId = (id, name) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return `${name} is not a valid ObjectId`;
  }
};

module.exports = isValidObjectId;
