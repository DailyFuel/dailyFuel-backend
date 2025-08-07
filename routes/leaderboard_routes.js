import { Router } from "express";
import Leaderboard from "../models/leaderboard.js";
import User from "../models/user.js";
import HabitLog from "../models/habit_log.js";
import Streak from "../models/streak.js";
import auth from "../src/auth.js"; // Change from firebaseAuth to auth

const router = Router();

// Get global leaderboard
router.get("/global/:timeFrame", auth, async (req, res) => {
  try {
    const { timeFrame } = req.params;
    const { category = 'all' } = req.query;

    let leaderboard = await Leaderboard.findOne({
      type: 'global',
      timeFrame,
      category
    });

    if (!leaderboard) {
      // Create new leaderboard if doesn't exist
      leaderboard = await Leaderboard.create({
        type: 'global',
        timeFrame,
        category,
        entries: []
      });
    }

    // Calculate scores based on timeFrame
    const entries = await calculateLeaderboardScores(timeFrame, category);
    
    // Update leaderboard
    leaderboard.entries = entries;
    leaderboard.lastCalculated = new Date();
    await leaderboard.save();

    res.send({ leaderboard });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Get friends leaderboard
router.get("/friends/:timeFrame", auth, async (req, res) => {
  try {
    const { timeFrame } = req.params;
    const user = await User.findById(req.auth.id);
    
    if (!user.friends.length) {
      return res.send({ leaderboard: { entries: [] } });
    }

    const entries = await calculateLeaderboardScores(timeFrame, 'all', user.friends);
    
    res.send({ 
      leaderboard: { 
        entries,
        type: 'friends',
        timeFrame 
      } 
    });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Helper function to calculate leaderboard scores
async function calculateLeaderboardScores(timeFrame, category = 'all', userIds = null) {
  const now = new Date();
  let startDate;

  switch (timeFrame) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'allTime':
      startDate = new Date(0);
      break;
  }

  let query = {
    date: { $gte: startDate.toISOString().slice(0, 10) }
  };

  if (userIds) {
    query.owner = { $in: userIds };
  }

  const logs = await HabitLog.find(query);
  const streaks = await Streak.find({
    end_date: null,
    ...(userIds && { owner: { $in: userIds } })
  });

  // Calculate scores
  const userScores = {};
  
  logs.forEach(log => {
    if (!userScores[log.owner]) {
      userScores[log.owner] = { completions: 0, streaks: 0 };
    }
    userScores[log.owner].completions++;
  });

  streaks.forEach(streak => {
    if (!userScores[streak.owner]) {
      userScores[streak.owner] = { completions: 0, streaks: 0 };
    }
    userScores[streak.owner].streaks++;
  });

  // Convert to entries
  const entries = Object.entries(userScores).map(([userId, scores]) => ({
    user: userId,
    score: scores.completions + (scores.streaks * 10), // Streaks worth more
    metric: 'completion',
    value: scores.completions,
    lastUpdated: new Date()
  }));

  // Sort by score and add ranks
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

export default router; 