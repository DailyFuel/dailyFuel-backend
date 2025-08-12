import { Router } from "express";
import CommunityChallenge from "../models/community_challenge.js";
import auth from "../src/auth.js"; // Change from firebaseAuth to auth

const router = Router();

// Get active community challenges
router.get("/active", auth, async (req, res) => {
  try {
    const challenges = await CommunityChallenge.find({
      status: 'active'
    }).populate('participants.user', 'name publicProfile');

    res.send({ challenges });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Join community challenge
router.post("/:challengeId/join", auth, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.auth.id;

    const challenge = await CommunityChallenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).send({ error: "Challenge not found" });
    }

    if (challenge.status !== 'active') {
      return res.status(400).send({ error: "Challenge is not active" });
    }

    // Check if already participating
    const alreadyParticipating = challenge.participants.find(
      p => p.user.toString() === userId
    );
    if (alreadyParticipating) {
      return res.status(400).send({ error: "Already participating in this challenge" });
    }

    challenge.participants.push({
      user: userId,
      progress: 0
    });
    await challenge.save();

    res.send({ message: "Joined challenge successfully" });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Update challenge progress
router.put("/:challengeId/progress", auth, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { progress } = req.body;
    const userId = req.auth.id;

    const challenge = await CommunityChallenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).send({ error: "Challenge not found" });
    }

    const participant = challenge.participants.find(
      p => p.user.toString() === userId
    );
    if (!participant) {
      return res.status(400).send({ error: "Not participating in this challenge" });
    }

    participant.progress = progress;
    await challenge.save();

    res.send({ message: "Progress updated successfully" });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

export default router;
