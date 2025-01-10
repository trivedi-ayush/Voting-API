const Candidate = require("../models/candidate.js");
const User = require("../models/user.js");
const checkAdminRole = require("../middlewares/checkAdminRole.js");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError.js");
const ApiResponse = require("../utils/ApiResponse.js");
const validateName = require("../utils/validateName.js");
const isValidObjectId = require("../utils/validateObjectId.js");
const client = require("../config/redis.js");

const addCandidate = async (req, res) => {
  try {
    let { name, party, age } = req.body;
    name = name.toUpperCase();
    party = party.toUpperCase();

    const existingCandidate = await Candidate.findOne({ name, party });
    if (existingCandidate) {
      return res
        .status(400)
        .json(new ApiError(400, "Candidate already exists."));
    }

    const newCandidate = new Candidate({
      name,
      party,
      age,
      createdBy: req.userId,
    });

    // Save the new user to the database
    const response = await newCandidate.save();

    // Invalidate the candidate cache
    await client.del("candidates");
    res
      .status(201)
      .json(new ApiResponse(201, "Candidate created successfully.", response));
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateCandidate = async (req, res) => {
  try {
    const restrictedFields = ["votes", "voteCount"];
    const bodyKeys = Object.keys(req.body);

    for (const key of restrictedFields) {
      if (bodyKeys.includes(key)) {
        return res
          .status(403)
          .json(new ApiError(403, `${key} cannot be updated`));
      }
    }

    const candidateID = req.params.candidateID;

    const candidateIdError = isValidObjectId(candidateID, "Candidate ID");

    if (candidateIdError) {
      return res.status(400).json(new ApiError(400, candidateID));
    }
    const { name, party, age } = req.body;

    const nameError = validateName(name, "name");
    const partyError = validateName(party, "party");
    if (nameError || partyError) {
      return res.status(400).json(new ApiError(400, nameError || partyError));
    }

    const response = await Candidate.findByIdAndUpdate(
      candidateID,
      { name, party, age },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!response) {
      return res.status(404).json(new ApiError(404, "Candidate not found"));
    }

    // Invalidate the candidate cache
    await client.del("candidates");

    res.status(200).json(new ApiResponse(200, response));
  } catch (err) {
    console.log(err);
    res.status(500).json(new ApiError(500, err.message));
  }
};

const deleteCandidate = async (req, res) => {
  try {
    const { candidateID } = req.params;

    const candidateIdError = isValidObjectId(candidateID, "Candidate ID");
    if (candidateIdError) {
      return res.status(400).json(new ApiError(400, candidateIdError));
    }

    const response = await Candidate.findByIdAndDelete(candidateID);

    if (!response) {
      return res.status(404).json(new ApiError(404, "Candidate not found"));
    }
    res.status(200).json(new ApiResponse(200, "Candidate deleted", response));
  } catch (err) {
    console.log(err);
    res.status(500).json(new ApiError(500, err.message));
  }
};

const vote = async (req, res) => {
  try {
    const { candidateID } = req.params;
    const userId = req.userId;

    const candidateIdError = isValidObjectId(candidateID, "Candidate ID");
    if (candidateIdError) {
      return res.status(400).json(new ApiError(400, candidateIdError));
    }

    const [candidate, user] = await Promise.all([
      Candidate.findById(candidateID),
      User.findById(userId),
    ]);

    if (!candidate) {
      return res.status(404).json(new ApiError(404, "Candidate not found"));
    }

    if (!user) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }
    if (user.role === "admin") {
      return res
        .status(403)
        .json(new ApiError(403, "Admin is not allowed to vote"));
    }
    if (user.isVoted) {
      return res.status(400).json(new ApiError(400, "You have already voted"));
    }

    // Update the Candidate document to record the vote
    candidate.votes.push({ user: userId });
    candidate.voteCount++;
    await candidate.save();

    // update the user document
    user.isVoted = true;
    await user.save();

    return res
      .status(200)
      .json(new ApiResponse(200, "Vote recorded successfully"));
  } catch (err) {
    console.log(err);
    return res.status(500).json(new ApiError(500, err.message));
  }
};

const voteCount = async (req, res) => {
  try {
    const cachedVotes = await client.get("voteCount");
    if (cachedVotes) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            "Vote Record fetched successfully (from cache)",
            JSON.parse(cachedVotes)
          )
        );
    }

    // Find all candidates and sort them by voteCount in descending order
    const candidate = await Candidate.find()
      .select("-_id party count")
      .sort({ voteCount: "desc" });

    //caching
    await client.set("voteCount", JSON.stringify(candidate));
    await client.expire("voteCount", 600);

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Vote Record fetched successfully", candidate)
      );
  } catch (err) {
    console.log(err);
    res.status(500).json(new ApiError(500, err.message));
  }
};

const getCandidates = async (req, res) => {
  try {
    const cachedCandidates = await client.get("candidates");
    if (cachedCandidates) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            "Candidates List fetched successfully (from cache)",
            JSON.parse(cachedCandidates)
          )
        );
    }

    const candidates = await Candidate.find({}, "name party -_id");
    if (!candidates) {
      return res.status(404).json(new ApiError(404, "No candidate found."));
    }

    //caching
    await client.set("candidates", JSON.stringify(candidates));
    await client.expire("candidates", 600);

    res
      .status(200)
      .json(
        new ApiResponse(200, "Candidates List fetched successfully", candidates)
      );
  } catch (err) {
    console.error(err);
    res.status(500).json(new ApiError(500, err.message));
  }
};

module.exports = {
  addCandidate,
  updateCandidate,
  deleteCandidate,
  vote,
  voteCount,
  getCandidates,
};
