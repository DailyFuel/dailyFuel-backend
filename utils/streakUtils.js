import Streak from "../models/streak.js";
import HabitLog from "../models/habit_log.js";
import dayjs from "dayjs";

/**
 * Update streaks for a user's habit after a log entry is created
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Array>} Array of saved streaks
 */
export const updateStreaks = async (userId, habitId) => {
  try {
    // Get all logs for this habit, sorted by date
    const logs = await HabitLog.find({ owner: userId, habit: habitId })
      .select("date -_id")
      .sort({ date: 1 })
      .lean();

    if (!logs.length) {
      // No logs exist, remove any existing streaks
      await Streak.deleteMany({ owner: userId, habit: habitId });
      return [];
    }

    const dates = logs.map(log => log.date);
    
    // Calculate streaks
    const streaks = calculateStreaks(dates);
    
    // Remove old streaks for this habit
    await Streak.deleteMany({ owner: userId, habit: habitId });

    // Save new streaks
    const savedStreaks = await Promise.all(
      streaks.map(({ start, end }) =>
        new Streak({
          owner: userId,
          habit: habitId,
          start_date: start.format("YYYY-MM-DD"),
          end_date: end.isSame(dayjs()) ? null : end.format("YYYY-MM-DD")
        }).save()
      )
    );

    // Mark longest streak
    await markLongestStreak(savedStreaks);

    return savedStreaks;
  } catch (error) {
    console.error('Error updating streaks:', error);
    throw error;
  }
};

/**
 * Calculate streaks from a sorted array of dates
 * @param {Array<string>} dates - Array of date strings in YYYY-MM-DD format
 * @returns {Array<Object>} Array of streak objects with start and end dayjs objects
 */
const calculateStreaks = (dates) => {
  const streaks = [];
  let start = null;

  for (let i = 0; i < dates.length; i++) {
    const curr = dayjs(dates[i]);
    const prev = i > 0 ? dayjs(dates[i - 1]) : null;

    if (!start) start = curr;

    if (prev && !curr.isSame(prev.add(1, "day"))) {
      // Break in streak
      streaks.push({ start, end: prev });
      start = curr;
    }
  }

  // Add the final streak
  if (start) {
    streaks.push({ start, end: dayjs(dates[dates.length - 1]) });
  }

  return streaks;
};

/**
 * Mark the longest streak among saved streaks
 * @param {Array<Object>} streaks - Array of saved streak objects
 */
const markLongestStreak = async (streaks) => {
  if (!streaks.length) return;

  let maxLength = 0;
  let longestStreak = null;

  streaks.forEach(streak => {
    const start = dayjs(streak.start_date);
    const end = streak.end_date ? dayjs(streak.end_date) : dayjs();
    const len = end.diff(start, "day") + 1;

    if (len > maxLength) {
      maxLength = len;
      longestStreak = streak;
    }
  });

  if (longestStreak) {
    longestStreak.longest = true;
    await longestStreak.save();
  }
};

/**
 * Get current ongoing streak for a habit
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Object|null>} Current streak or null
 */
export const getCurrentStreak = async (userId, habitId) => {
  try {
    const streak = await Streak.findOne({
      habit: habitId,
      owner: userId,
      end_date: null
    });

    return streak;
  } catch (error) {
    console.error('Error getting current streak:', error);
    throw error;
  }
};

/**
 * Get all streaks for a habit
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Array>} Array of streaks
 */
export const getAllStreaks = async (userId, habitId) => {
  try {
    const streaks = await Streak.find({ 
      habit: habitId, 
      owner: userId 
    }).sort({ start_date: -1 });
    
    return streaks;
  } catch (error) {
    console.error('Error getting all streaks:', error);
    throw error;
  }
};

/**
 * Get streak statistics for a habit
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Object>} Streak statistics
 */
export const getStreakStats = async (userId, habitId) => {
  try {
    const streaks = await getAllStreaks(userId, habitId);
    
    if (!streaks.length) {
      return {
        totalStreaks: 0,
        longestStreak: 0,
        currentStreak: 0,
        averageStreak: 0
      };
    }

    const currentStreak = await getCurrentStreak(userId, habitId);
    const longestStreak = streaks.find(s => s.longest);
    
    const streakLengths = streaks.map(streak => {
      const start = dayjs(streak.start_date);
      const end = streak.end_date ? dayjs(streak.end_date) : dayjs();
      return end.diff(start, "day") + 1;
    });

    return {
      totalStreaks: streaks.length,
      longestStreak: longestStreak ? dayjs(longestStreak.end_date || dayjs()).diff(dayjs(longestStreak.start_date), "day") + 1 : 0,
      currentStreak: currentStreak ? dayjs().diff(dayjs(currentStreak.start_date), "day") + 1 : 0,
      averageStreak: Math.round(streakLengths.reduce((a, b) => a + b, 0) / streakLengths.length)
    };
  } catch (error) {
    console.error('Error getting streak stats:', error);
    throw error;
  }
};
