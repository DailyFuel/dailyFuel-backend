import Notification from "../models/notification.js";
import Habit from "../models/habit.js";
import HabitLog from "../models/habit_log.js";
import Streak from "../models/streak.js";
import dayjs from "dayjs";

/**
 * Create a notification for a user
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {Object} data - Notification data
 */
export const createNotification = async (userId, type, data = {}) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title: data.title || getDefaultTitle(type),
      message: data.message || getDefaultMessage(type, data),
      data: data,
      platform: data.platform || "in_app"
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

/**
 * Get default title for notification type
 */
const getDefaultTitle = (type) => {
  const titles = {
    habit_reminder: "Habit Reminder",
    streak_milestone: "Streak Milestone!",
    achievement_unlocked: "Achievement Unlocked!",
    streak_break: "Streak Alert",
    motivation: "Daily Motivation",
    social_activity: "Social Activity",
    subscription: "Subscription Update",
    friend_request: "New Friend Request",
    friend_request_accepted: "Friend Request Accepted"
  };
  return titles[type] || "Notification";
};

/**
 * Get default message for notification type
 */
const getDefaultMessage = (type, data) => {
  switch (type) {
    case "friend_request":
      return `${data.fromUserName || "Someone"} sent you a friend request`;
    case "friend_request_accepted":
      return `${data.acceptedByUserName || "Someone"} accepted your friend request`;
    case "social_activity":
      return data.message || "You have new social activity";
    case "habit_reminder":
      return "Don't forget to log your habits today!";
    case "streak_milestone":
      return `Congratulations! You've reached a ${data.streakDays || 0}-day streak!`;
    case "achievement_unlocked":
      return `You've unlocked: ${data.achievementTitle || "New Achievement"}!`;
    case "streak_break":
      return "You're close to breaking your streak. Log a habit now!";
    case "motivation":
      return "Every small step counts. Keep going!";
    default:
      return "You have a new notification";
  }
};

/**
 * Send habit reminder notifications
 * @param {string} userId - User ID
 */
export const sendHabitReminders = async (userId) => {
  try {
    const user = await Habit.find({ owner: userId });
    if (!user.length) return;

    // Check if user has logged today
    const today = dayjs().format("YYYY-MM-DD");
    const todayLogs = await HabitLog.find({
      owner: userId,
      date: today
    });

    if (todayLogs.length === 0) {
      await createNotification(userId, "habit_reminder", {
        title: "Don't forget your habits!",
        message: "You haven't logged any habits today. Keep your streak alive!",
        platform: "push"
      });
    }
  } catch (error) {
    console.error("Error sending habit reminders:", error);
  }
};

/**
 * Send streak milestone notifications
 * @param {string} userId - User ID
 * @param {number} streakDays - Number of streak days
 */
export const sendStreakMilestoneNotification = async (userId, streakDays) => {
  try {
    const milestoneDays = [7, 30, 100, 365];
    
    if (milestoneDays.includes(streakDays)) {
      await createNotification(userId, "streak_milestone", {
        title: `🔥 ${streakDays}-Day Streak!`,
        message: `Amazing! You've maintained a ${streakDays}-day streak. Keep it up!`,
        streakDays,
        platform: "push"
      });
    }
  } catch (error) {
    console.error("Error sending streak milestone notification:", error);
  }
};

/**
 * Send achievement unlocked notifications
 * @param {string} userId - User ID
 * @param {Object} achievement - Achievement object
 */
export const sendAchievementNotification = async (userId, achievement) => {
  try {
    await createNotification(userId, "achievement_unlocked", {
      title: `${achievement.icon} Achievement Unlocked!`,
      message: `${achievement.title}: ${achievement.description}`,
      achievementTitle: achievement.title,
      achievementId: achievement._id,
      platform: "push"
    });
  } catch (error) {
    console.error("Error sending achievement notification:", error);
  }
};

/**
 * Send streak break warning notifications
 * @param {string} userId - User ID
 */
export const sendStreakBreakWarnings = async (userId) => {
  try {
    const activeStreaks = await Streak.find({
      owner: userId,
      end_date: null
    });

    for (const streak of activeStreaks) {
      const lastLog = await HabitLog.findOne({
        habit: streak.habit,
        owner: userId
      }).sort({ date: -1 });

      if (lastLog) {
        const daysSinceLastLog = dayjs().diff(dayjs(lastLog.date), "day");
        
        if (daysSinceLastLog >= 1) {
          await createNotification(userId, "streak_break", {
            title: "⚠️ Streak at Risk!",
            message: "You're about to break your streak. Log a habit now!",
            habitId: streak.habit,
            daysSinceLastLog,
            platform: "push"
          });
        }
      }
    }
  } catch (error) {
    console.error("Error sending streak break warnings:", error);
  }
};

/**
 * Send motivational notifications
 * @param {string} userId - User ID
 */
export const sendMotivationalNotification = async (userId) => {
  try {
    const messages = [
      "Every expert was once a beginner. Keep going!",
      "Small progress is still progress. You're doing great!",
      "Consistency beats perfection. Keep showing up!",
      "Your future self will thank you for today's effort.",
      "You're building habits that will last a lifetime."
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    await createNotification(userId, "motivation", {
      title: "💪 Daily Motivation",
      message: randomMessage,
      platform: "push"
    });
  } catch (error) {
    console.error("Error sending motivational notification:", error);
  }
};

/**
 * Get user notifications
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 */
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = options;
    
    const query = { user: userId };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    return notifications;
  } catch (error) {
    console.error("Error getting user notifications:", error);
    return [];
  }
};

/**
 * Mark notification as read
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { read: true },
      { new: true }
    );

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return null;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    await Notification.updateMany(
      { user: userId, read: false },
      { read: true }
    );

    return true;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return false;
  }
};

/**
 * Get notification statistics for a user
 * @param {string} userId - User ID
 */
export const getNotificationStats = async (userId) => {
  try {
    const totalNotifications = await Notification.countDocuments({ user: userId });
    const unreadNotifications = await Notification.countDocuments({ 
      user: userId, 
      read: false 
    });

    return {
      totalNotifications,
      unreadNotifications,
      readNotifications: totalNotifications - unreadNotifications
    };
  } catch (error) {
    console.error("Error getting notification stats:", error);
    return { totalNotifications: 0, unreadNotifications: 0, readNotifications: 0 };
  }
}; 