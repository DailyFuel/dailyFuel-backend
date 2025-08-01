import { Router } from "express";
import SocialShare from "../models/social_share.js";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js";
import Achievement from "../models/achievement.js";
import { auth } from "../src/auth.js";
import { checkAchievements } from "../services/achievement_service.js";
import { nanoid } from "nanoid";
import dayjs from "dayjs";

const router = Router();

// Share a streak
router.post("/streak/:streakId", auth, async (req, res) => {
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
router.post("/achievement/:achievementId", auth, async (req, res) => {
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

    // Check for social sharing achievements
    await checkAchievements(req.auth.id, "social_shared", {
      shareCount: await SocialShare.countDocuments({ user: req.auth.id })
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
router.post("/progress", auth, async (req, res) => {
  try {
    const { platform, customMessage, timeRange = "week" } = req.body;

    // Get user's progress stats
    const totalHabits = await Habit.countDocuments({ owner: req.auth.id });
    const totalLogs = await HabitLog.countDocuments({ owner: req.auth.id });
    const activeStreaks = await Streak.find({
      owner: req.auth.id,
      end_date: null
    });
    const achievements = await Achievement.countDocuments({ user: req.auth.id });

    // Generate share content
    const shareContent = {
      title: "📊 My Daily Fuel Progress",
      description: customMessage || `I've completed ${totalLogs} habits with ${activeStreaks.length} active streaks and ${achievements} achievements! #DailyFuel #Progress`,
      hashtags: ["#DailyFuel", "#Progress", "#Habits", "#Consistency"],
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
        totalLogs,
        activeStreaks: activeStreaks.length,
        achievements,
        timeRange
      },
      shareUrl: `https://dailyfuel.app/share/progress/${nanoid(8)}`
    });

    // Check for social sharing achievements
    await checkAchievements(req.auth.id, "social_shared", {
      shareCount: await SocialShare.countDocuments({ user: req.auth.id })
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

// Get user's sharing history
router.get("/history", auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

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

// Get sharing statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const totalShares = await SocialShare.countDocuments({ user: req.auth.id });
    
    // Count by platform
    const platformStats = await SocialShare.aggregate([
      { $match: { user: req.auth.id } },
      { $group: { _id: "$platform", count: { $sum: 1 } } }
    ]);

    // Count by type
    const typeStats = await SocialShare.aggregate([
      { $match: { user: req.auth.id } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    // Total clicks and shares
    const engagementStats = await SocialShare.aggregate([
      { $match: { user: req.auth.id } },
      { 
        $group: { 
          _id: null, 
          totalClicks: { $sum: "$clicks" },
          totalShares: { $sum: "$shares" }
        } 
      }
    ]);

    res.send({
      totalShares,
      platformStats,
      typeStats,
      engagement: engagementStats[0] || { totalClicks: 0, totalShares: 0 }
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Track share click (for analytics)
router.post("/track/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params;

    await SocialShare.findByIdAndUpdate(shareId, {
      $inc: { clicks: 1 }
    });

    res.send({ message: "Click tracked successfully" });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

export default router; 