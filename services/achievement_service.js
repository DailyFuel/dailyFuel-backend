import Achievement from "../models/achievement.js";
import HabitLog from "../models/habit_log.js";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js";
import SocialShare from "../models/social_share.js";
import dayjs from "dayjs";

/**
 * Check and unlock achievements for a user
 * @param {string} userId - User ID
 * @param {string} triggerType - Type of action that triggered the check
 * @param {Object} metadata - Additional data for the achievement
 */
export const checkAchievements = async (userId, triggerType, metadata = {}) => {
  try {
    const achievements = [];

    // First habit achievement
    if (triggerType === "habit_created") {
      const habitCount = await Habit.countDocuments({ owner: userId });
      if (habitCount === 1) {
        achievements.push(await unlockAchievement(userId, "first_habit", {
          title: "First Steps",
          description: "Created your first habit!",
          icon: "🎯"
        }));
      }
    }

    // First log achievement
    if (triggerType === "habit_logged") {
      const logCount = await HabitLog.countDocuments({ owner: userId });
      if (logCount === 1) {
        achievements.push(await unlockAchievement(userId, "first_log", {
          title: "Getting Started",
          description: "Logged your first habit!",
          icon: "✅"
        }));
      }
    }

    // Streak milestones
    if (triggerType === "streak_updated" && metadata.streakDays) {
      const streakDays = metadata.streakDays;
      
      if (streakDays >= 7) {
        achievements.push(await unlockAchievement(userId, "streak_milestone", {
          title: "Week Warrior",
          description: "Maintained a 7-day streak!",
          icon: "🔥",
          metadata: { streakDays: 7 }
        }));
      }
      
      if (streakDays >= 30) {
        achievements.push(await unlockAchievement(userId, "streak_milestone", {
          title: "Monthly Master",
          description: "Maintained a 30-day streak!",
          icon: "🔥🔥",
          metadata: { streakDays: 30 }
        }));
      }
      
      if (streakDays >= 100) {
        achievements.push(await unlockAchievement(userId, "streak_milestone", {
          title: "Century Club",
          description: "Maintained a 100-day streak!",
          icon: "🔥🔥🔥",
          metadata: { streakDays: 100 }
        }));
      }
    }

    // Habit master achievements
    if (triggerType === "habit_logged") {
      const totalLogs = await HabitLog.countDocuments({ owner: userId });
      
      if (totalLogs >= 10) {
        achievements.push(await unlockAchievement(userId, "habit_master", {
          title: "Habit Builder",
          description: "Logged 10 habits!",
          icon: "🏗️",
          metadata: { totalLogs: 10 }
        }));
      }
      
      if (totalLogs >= 50) {
        achievements.push(await unlockAchievement(userId, "habit_master", {
          title: "Habit Veteran",
          description: "Logged 50 habits!",
          icon: "🎖️",
          metadata: { totalLogs: 50 }
        }));
      }
      
      if (totalLogs >= 100) {
        achievements.push(await unlockAchievement(userId, "habit_master", {
          title: "Habit Legend",
          description: "Logged 100 habits!",
          icon: "👑",
          metadata: { totalLogs: 100 }
        }));
      }
    }

    // Time-based achievements
    if (triggerType === "habit_logged" && metadata.logTime) {
      const hour = dayjs(metadata.logTime).hour();
      
      if (hour >= 6 && hour < 12) {
        achievements.push(await unlockAchievement(userId, "early_bird", {
          title: "Early Bird",
          description: "Logged a habit before noon!",
          icon: "🌅"
        }));
      }
      
      if (hour >= 22 || hour < 6) {
        achievements.push(await unlockAchievement(userId, "night_owl", {
          title: "Night Owl",
          description: "Logged a habit late at night!",
          icon: "🦉"
        }));
      }
    }

    // Weekend warrior
    if (triggerType === "habit_logged" && metadata.logTime) {
      const dayOfWeek = dayjs(metadata.logTime).day();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        achievements.push(await unlockAchievement(userId, "weekend_warrior", {
          title: "Weekend Warrior",
          description: "Logged a habit on the weekend!",
          icon: "🏃‍♂️"
        }));
      }
    }

    // Social butterfly
    if (triggerType === "social_shared") {
      const shareCount = await SocialShare.countDocuments({ user: userId });
      
      if (shareCount >= 5) {
        achievements.push(await unlockAchievement(userId, "social_butterfly", {
          title: "Social Butterfly",
          description: "Shared 5 times!",
          icon: "🦋",
          metadata: { shareCount: 5 }
        }));
      }
      
      if (shareCount >= 10) {
        achievements.push(await unlockAchievement(userId, "social_butterfly", {
          title: "Viral Sensation",
          description: "Shared 10 times!",
          icon: "📱",
          metadata: { shareCount: 10 }
        }));
      }
    }

    return achievements.filter(Boolean); // Remove null values
  } catch (error) {
    console.error("Error checking achievements:", error);
    return [];
  }
};

/**
 * Unlock a specific achievement for a user
 * @param {string} userId - User ID
 * @param {string} type - Achievement type
 * @param {Object} achievementData - Achievement data
 */
const unlockAchievement = async (userId, type, achievementData) => {
  try {
    // Check if achievement already exists
    const existing = await Achievement.findOne({ user: userId, type });
    if (existing) return null;

    const achievement = await Achievement.create({
      user: userId,
      type,
      title: achievementData.title,
      description: achievementData.description,
      icon: achievementData.icon,
      metadata: achievementData.metadata || {}
    });

    return achievement;
  } catch (error) {
    console.error("Error unlocking achievement:", error);
    return null;
  }
};

/**
 * Get all achievements for a user
 * @param {string} userId - User ID
 */
export const getUserAchievements = async (userId) => {
  try {
    const achievements = await Achievement.find({ user: userId })
      .sort({ unlockedAt: -1 });
    
    return achievements;
  } catch (error) {
    console.error("Error getting user achievements:", error);
    return [];
  }
};

/**
 * Get achievement statistics for a user
 * @param {string} userId - User ID
 */
export const getAchievementStats = async (userId) => {
  try {
    const achievements = await Achievement.find({ user: userId });
    const totalAchievements = achievements.length;
    
    // Count by type
    const typeCounts = {};
    achievements.forEach(achievement => {
      typeCounts[achievement.type] = (typeCounts[achievement.type] || 0) + 1;
    });

    return {
      totalAchievements,
      typeCounts,
      recentAchievements: achievements.slice(0, 5) // Last 5 achievements
    };
  } catch (error) {
    console.error("Error getting achievement stats:", error);
    return { totalAchievements: 0, typeCounts: {}, recentAchievements: [] };
  }
}; 