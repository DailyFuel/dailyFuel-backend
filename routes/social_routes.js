import { Router } from "express";
import SocialShare from "../models/social_share.js";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js";
import Achievement from "../models/achievement.js";
import firebaseAuth from "../src/firebase-auth.js";
import { checkAchievements } from "../services/achievement_service.js";
import { checkFreeTierSocialLimit } from "../middleware/subscriptionCheck.js";
import { nanoid } from "nanoid";
import dayjs from "dayjs";

const router = Router();

// Share a streak
router.post("/streak/:streakId", firebaseAuth, checkFreeTierSocialLimit, async (req, res) => {
  try {
    const { streakId } = req.params;
    const { platform, customMessage } = req.body;

    // Verify the streak belongs to the user
    const streak = await Streak.findOne({
      _id: streakId,
      owner: req.auth.id
    });

    if (!streak) {
      return res.status(404).send({ error: "Streak not found or unauthorized" });
    }

    // Get habit details
    const habit = await Habit.findById(streak.habit);
    if (!habit) {
      return res.status(404).send({ error: "Habit not found" });
    }

    // Calculate streak days
    const startDate = dayjs(streak.start_date);
    const endDate = streak.end_date ? dayjs(streak.end_date) : dayjs();
    const streakDays = endDate.diff(startDate, "day") + 1;

    // Generate share content
    const shareContent = {
      title: `🔥 ${streakDays}-Day ${habit.name} Streak!`,
      description: customMessage || `I've been doing ${habit.name} for ${streakDays} days straight! #DailyFuel #HabitTracking`,
      hashtags: ["#DailyFuel", "#HabitTracking", "#Streak", "#Consistency"],
      imageUrl: null // Could be generated dynamically
    };

    // Create social share record
    const socialShare = await SocialShare.create({
      user: req.auth.id,
      type: "streak",
      platform,
      content: shareContent,
      metadata: {
        habitId: habit._id,
        streakId: streak._id,
        streakDays
      },
      shareUrl: `https://dailyfuel.app/share/streak/${nanoid(8)}`
    });

    // Check for social sharing achievements
    await checkAchievements(req.auth.id, "social_shared", {
      shareCount: await SocialShare.countDocuments({ user: req.auth.id })
    });

    res.status(201).send({
      message: "Streak shared successfully!",
      share: socialShare,
      shareUrl: socialShare.shareUrl
    });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Share an achievement
router.post("/achievement/:achievementId", firebaseAuth, checkFreeTierSocialLimit, async (req, res) => {
  try {
    const { achievementId } = req.params;
    const { platform, customMessage } = req.body;

    // Verify the achievement belongs to the user
    const achievement = await Achievement.findOne({
      _id: achievementId,
      user: req.auth.id
    });

    if (!achievement) {
      return res.status(404).send({ error: "Achievement not found or unauthorized" });
    }

    // Generate share content
    const shareContent = {
      title: `${achievement.icon} Achievement Unlocked!`,
      description: customMessage || `I just unlocked "${achievement.title}" in Daily Fuel! ${achievement.description} #DailyFuel #Achievement`,
      hashtags: ["#DailyFuel", "#Achievement", "#Progress", "#Habits"],
      imageUrl: null
    };

    // Create social share record
    const socialShare = await SocialShare.create({
      user: req.auth.id,
      type: "achievement",
      platform,
      content: shareContent,
      metadata: {
        achievementId: achievement._id,
        achievementType: achievement.type
      },
      shareUrl: `https://dailyfuel.app/share/achievement/${nanoid(8)}`
    });

    res.status(201).send({
      message: "Achievement shared successfully!",
      share: socialShare,
      shareUrl: socialShare.shareUrl
    });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Share progress summary
router.post("/progress", firebaseAuth, checkFreeTierSocialLimit, async (req, res) => {
  try {
    const { platform, customMessage, timeRange = "week" } = req.body;

    // Get user's habits and recent activity
    const habits = await Habit.find({ owner: req.auth.id });
    const recentLogs = await HabitLog.find({
      owner: req.auth.id,
      date: {
        $gte: dayjs().subtract(7, "day").format("YYYY-MM-DD")
      }
    });

    // Calculate progress metrics
    const totalHabits = habits.length;
    const completedToday = recentLogs.filter(log => 
      dayjs(log.date).isSame(dayjs(), "day")
    ).length;

    const activeStreaks = await Streak.countDocuments({
      owner: req.auth.id,
      end_date: null
    });

    // Generate share content
    const shareContent = {
      title: `📊 My Daily Fuel Progress`,
      description: customMessage || `I'm tracking ${totalHabits} habits and completed ${completedToday} today! ${activeStreaks} active streaks. #DailyFuel #Progress`,
      hashtags: ["#DailyFuel", "#Progress", "#HabitTracking", "#Consistency"],
      imageUrl: null
    };

    // Create social share record
    const socialShare = await SocialShare.create({
      user: req.auth.id,
      type: "progress",
      platform,
      content: shareContent,
      metadata: {
        totalHabits,
        completedToday,
        activeStreaks,
        timeRange
      },
      shareUrl: `https://dailyfuel.app/share/progress/${nanoid(8)}`
    });

    res.status(201).send({
      message: "Progress shared successfully!",
      share: socialShare,
      shareUrl: socialShare.shareUrl
    });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Get user's social sharing history
router.get("/history", firebaseAuth, async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const shares = await SocialShare.find({ user: req.auth.id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const totalShares = await SocialShare.countDocuments({ user: req.auth.id });

    res.send({
      shares,
      totalShares,
      hasMore: totalShares > parseInt(offset) + shares.length
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get share statistics
router.get("/stats", firebaseAuth, async (req, res) => {
  try {
    const totalShares = await SocialShare.countDocuments({ user: req.auth.id });
    
    const platformStats = await SocialShare.aggregate([
      { $match: { user: req.auth.id } },
      { $group: { _id: "$platform", count: { $sum: 1 } } }
    ]);

    const typeStats = await SocialShare.aggregate([
      { $match: { user: req.auth.id } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    res.send({
      totalShares,
      platformStats,
      typeStats
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Delete a social share
router.delete("/:shareId", firebaseAuth, async (req, res) => {
  try {
    const { shareId } = req.params;

    const share = await SocialShare.findOneAndDelete({
      _id: shareId,
      user: req.auth.id
    });

    if (!share) {
      return res.status(404).send({ error: "Share not found or unauthorized" });
    }

    res.send({ message: "Share deleted successfully" });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

export default router;