const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/jwt.js");
const userValidationSchema = require("../validator/userValidator.js");
const validate = require("../middlewares/validateMiddleware.js");
const noQueryParamsAllowed = require("../middlewares/noQueryParams.js");
const resetPasswordLimiter = require("../middlewares/rateLimitter.js");
const upload = require("../middlewares/uploadMiddleware.js");

const {
  register,
  login,
  getUserProfile,
  updatePassword,
  logout,
  requestPasswordReset,
  passwordReset,
} = require("../controllers/userController.js");

router.post(
  "/signup",
  upload.single("profilePicture"),
  validate(userValidationSchema),
  register
);
router.post("/login", noQueryParamsAllowed, login);
router.post("/logout", authMiddleware, noQueryParamsAllowed, logout);
router.get("/profile", authMiddleware, noQueryParamsAllowed, getUserProfile);
router.put(
  "/update-password",
  authMiddleware,
  noQueryParamsAllowed,
  updatePassword
);

router.post(
  "/request-password-reset",
  authMiddleware,
  noQueryParamsAllowed,
  resetPasswordLimiter,
  requestPasswordReset
);

router.post(
  "/password-reset",
  authMiddleware,
  noQueryParamsAllowed,
  passwordReset
);

module.exports = router;
