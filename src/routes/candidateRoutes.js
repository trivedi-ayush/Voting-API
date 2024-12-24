const express = require("express");
const router = express.Router();
const { authMiddleware, generateToken } = require("../middlewares/jwt.js");
const {
  candidateValidationSchema,
  updateCandidateSchema,
} = require("../validator/candidateValidator.js");
const validate = require("../middlewares/validateMiddleware.js");
const noQueryParams = require("../middlewares/noQueryParams.js");
const checkAdminRole = require("../middlewares/checkAdminRole.js");
const {
  addCandidate,
  updateCandidate,
  deleteCandidate,
  vote,
  voteCount,
  getCandidates,
} = require("../controllers/candidateController.js");

router.post(
  "/",
  authMiddleware,
  checkAdminRole,
  validate(candidateValidationSchema),
  addCandidate
);
router.put(
  "/update-candidate/:candidateID",
  authMiddleware,
  validate(updateCandidateSchema),
  updateCandidate
);
router.delete(
  "/delete-candidate/:candidateID",
  authMiddleware,
  checkAdminRole,
  noQueryParams,
  deleteCandidate
);
router.get("/vote/:candidateID", authMiddleware, noQueryParams, vote);
router.get("/vote-count", authMiddleware, noQueryParams, voteCount);
router.get("/", authMiddleware, noQueryParams, getCandidates);

module.exports = router;
