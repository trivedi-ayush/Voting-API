const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/jwt.js");
const {
  userValidationSchema,
  userUpdateValidationSchema,
} = require("../validator/userValidator.js");
const validate = require("../middlewares/validateMiddleware.js");
const noQueryParamsAllowed = require("../middlewares/noQueryParams.js");
const resetPasswordLimiter = require("../middlewares/rateLimitter.js");
const {upload} = require("../middlewares/uploadMiddleware.js");
const multerErrorHandler = require("../middlewares/multerErrorHandler.js");

const {
  register,
  login,
  getUserProfile,
  logout,
  requestPasswordReset,
  passwordReset,
  updateUser,
} = require("../controllers/userController.js");

router.post(
  "/signup",
  upload.single("profilePicture"),
  multerErrorHandler,
  validate(userValidationSchema),
  register
);

router.put(
  "/updateUser",
  authMiddleware,
  validate(userUpdateValidationSchema),
  upload.single("profilePicture"),
  multerErrorHandler,
  updateUser
);

router.post("/login", noQueryParamsAllowed, login);
router.post("/logout", authMiddleware, noQueryParamsAllowed, logout);
router.get("/profile", authMiddleware, noQueryParamsAllowed, getUserProfile);

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
