function ApiError(status, message) {
  Error.call(this, message); 
  // this.name = "ApiError";
  this.status = status;
  this.error = message;
}

// Inherit from the Error prototype
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

module.exports = ApiError;
