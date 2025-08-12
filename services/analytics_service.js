import Analytics from "../models/analytics.js";
import HabitLog from "../models/habit_log.js";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js";
import Achievement from "../models/achievement.js";
import dayjs from "dayjs";

/**
 * Update daily analytics for a user
 * @param {string} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 */
export const updateDailyAnalytics = async (userId, date) => {
  try {
    // Get today's logs
    const todayLogs = await HabitLog.find({
      owner: userId,
      date: date
    });

    // Get total habits for the user
    const totalHabits = await Habit.countDocuments({ owner: userId });

    // Get active streaks
    const activeStreaks = await Streak.find({
      owner: userId,
      end_date: null
    });

    // Compute longest streak by maximum duration across all streaks
    // Duration is (end_date or provided date) - start_date, in days
    const allStreaks = await Streak.find({ owner: userId }).select('start_date end_date');
    const todayRef = dayjs(date);
    let longestStreakDays = 0;
    for (const s of allStreaks) {
      if (!s?.start_date) continue;
      const start = dayjs(String(s.start_date));
      const end = s?.end_date ? dayjs(String(s.end_date)) : todayRef;
      if (!start.isValid() || !end.isValid()) continue;
      const days = Math.max(0, end.diff(start, 'day') + 1);
      if (days > longestStreakDays) longestStreakDays = days;
    }

    // Get achievements unlocked today
    const todayAchievements = await Achievement.find({
      user: userId,
      unlockedAt: {
        $gte: dayjs(date).startOf('day').toDate(),
        $lte: dayjs(date).endOf('day').toDate()
      }
    });

    // Calculate time of day distribution using HabitLog.createdAt if available
    let timeOfDay = null;
    try {
      // createdAt exists because HabitLog schema enables timestamps
      const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      for (const log of todayLogs) {
        const created = log?.createdAt ? dayjs(log.createdAt) : null;
        if (!created || !created.isValid()) continue;
        const hour = created.hour();
        if (hour >= 6 && hour < 12) buckets.morning += 1;
        else if (hour >= 12 && hour < 18) buckets.afternoon += 1;
        else if (hour >= 18 && hour < 24) buckets.evening += 1;
        else buckets.night += 1; // 0-6
      }
      timeOfDay = buckets;
    } catch {
      timeOfDay = null;
    }

    // Calculate completion rate
    const completionRate = totalHabits > 0 ? (todayLogs.length / totalHabits) * 100 : 0;

    // Determine day of week
    const dayOfWeek = dayjs(date).format('dddd').toLowerCase();
    const isWeekend = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';

    // Create or update analytics
    const analyticsData = {
      user: userId,
      date: date,
      habitsCompleted: todayLogs.length,
      totalHabits: totalHabits,
      completionRate: Math.round((completionRate ?? 0) * 100) / 100,
      streaksActive: activeStreaks.length,
      longestStreak: longestStreakDays,
      achievementsUnlocked: todayAchievements.length,
      timeOfDay: timeOfDay,
      dayOfWeek: dayOfWeek,
      isWeekend: isWeekend
    };

    await Analytics.findOneAndUpdate(
      { user: userId, date: date },
      analyticsData,
      { upsert: true, new: true }
    );

    return analyticsData;
  } catch (error) {
    console.error("Error updating daily analytics:", error);
    return null;
  }
};

/**
 * Get analytics for a date range
 * @param {string} userId - User ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getAnalyticsForDateRange = async (userId, startDate, endDate) => {
  try {
    const analytics = await Analytics.find({
      user: userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

    return analytics;
  } catch (error) {
    console.error("Error getting analytics for date range:", error);
    return [];
  }
};

/**
 * Get weekly analytics
 * @param {string} userId - User ID
 */
export const getWeeklyAnalytics = async (userId) => {
  try {
    const startOfWeek = dayjs().startOf('week').format('YYYY-MM-DD');
    const endOfWeek = dayjs().endOf('week').format('YYYY-MM-DD');

    const analytics = await getAnalyticsForDateRange(userId, startOfWeek, endOfWeek);

    // Calculate weekly summary
    const weeklySummary = {
      totalHabitsCompleted: analytics.reduce((sum, day) => sum + (day.habitsCompleted || 0), 0),
      averageCompletionRate: analytics.length > 0 
        ? analytics.reduce((sum, day) => sum + (day.completionRate || 0), 0) / analytics.length 
        : 0,
      daysWithPerfectCompletion: analytics.filter(day => (day.completionRate || 0) === 100).length,
      longestStreakThisWeek: Math.max(...analytics.map(day => day.longestStreak || 0), 0),
      achievementsUnlocked: analytics.reduce((sum, day) => sum + (day.achievementsUnlocked || 0), 0)
    };

    return {
      dailyData: analytics,
      summary: weeklySummary
    };
  } catch (error) {
    console.error("Error getting weekly analytics:", error);
    return { 
      dailyData: [], 
      summary: {
        totalHabitsCompleted: 0,
        averageCompletionRate: 0,
        daysWithPerfectCompletion: 0,
        longestStreakThisWeek: 0,
        achievementsUnlocked: 0
      }
    };
  }
};

/**
 * Get monthly analytics
 * @param {string} userId - User ID
 */
export const getMonthlyAnalytics = async (userId) => {
  try {
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');

    const analytics = await getAnalyticsForDateRange(userId, startOfMonth, endOfMonth);

    // Calculate monthly summary
    const monthlySummary = {
      totalHabitsCompleted: analytics.reduce((sum, day) => sum + (day.habitsCompleted || 0), 0),
      averageCompletionRate: analytics.length > 0 
        ? analytics.reduce((sum, day) => sum + (day.completionRate || 0), 0) / analytics.length 
        : 0,
      perfectDays: analytics.filter(day => (day.completionRate || 0) === 100).length,
      weekendDays: analytics.filter(day => day.isWeekend).length,
      weekdayDays: analytics.filter(day => !day.isWeekend).length,
      achievementsUnlocked: analytics.reduce((sum, day) => sum + (day.achievementsUnlocked || 0), 0)
    };

    return {
      dailyData: analytics,
      summary: monthlySummary
    };
  } catch (error) {
    console.error("Error getting monthly analytics:", error);
    return { 
      dailyData: [], 
      summary: {
        totalHabitsCompleted: 0,
        averageCompletionRate: 0,
        perfectDays: 0,
        weekendDays: 0,
        weekdayDays: 0,
        achievementsUnlocked: 0
      }
    };
  }
};

/**
 * Get progress insights
 * @param {string} userId - User ID
 */
export const getProgressInsights = async (userId) => {
  try {
    const last30Days = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');

    const analytics = await getAnalyticsForDateRange(userId, last30Days, today);

    if (analytics.length === 0) {
      return {
        message: "Start logging habits to see your progress insights!",
        trends: [],
        recommendations: ["Create your first habit", "Log your first habit"]
      };
    }

    // Calculate trends
    const trends = [];
    const recentCompletionRate = analytics.slice(-7).reduce((sum, day) => sum + day.completionRate, 0) / 7;
    const olderCompletionRate = analytics.slice(0, 7).reduce((sum, day) => sum + day.completionRate, 0) / 7;

    if (recentCompletionRate > olderCompletionRate + 10) {
      trends.push("You're improving! Your completion rate has increased recently.");
    } else if (recentCompletionRate < olderCompletionRate - 10) {
      trends.push("Your completion rate has decreased. Try to get back on track!");
    } else {
      trends.push("Your completion rate is stable. Keep up the consistency!");
    }

    // Generate recommendations
    const recommendations = [];
    const averageCompletionRate = analytics.reduce((sum, day) => sum + day.completionRate, 0) / analytics.length;

    if (averageCompletionRate < 50) {
      recommendations.push("Try starting with just one habit to build momentum");
      recommendations.push("Set smaller, more achievable goals");
    } else if (averageCompletionRate < 80) {
      recommendations.push("Great progress! Try adding one more habit");
      recommendations.push("Consider setting reminders for your habits");
    } else {
      recommendations.push("Excellent consistency! You're crushing it!");
      recommendations.push("Consider sharing your progress to inspire others");
    }

    // Check for weekend vs weekday patterns
    const weekendDays = analytics.filter(day => day.isWeekend);
    const weekdayDays = analytics.filter(day => !day.isWeekend);

    if (weekendDays.length > 0 && weekdayDays.length > 0) {
      const weekendAvg = weekendDays.reduce((sum, day) => sum + day.completionRate, 0) / weekendDays.length;
      const weekdayAvg = weekdayDays.reduce((sum, day) => sum + day.completionRate, 0) / weekdayDays.length;

      if (weekendAvg < weekdayAvg - 20) {
        recommendations.push("You tend to struggle on weekends. Try setting weekend-specific habits");
      }
    }

    return {
      message: "Here's how you're doing:",
      trends,
      recommendations,
      stats: {
        averageCompletionRate: Math.round(averageCompletionRate),
        totalHabitsCompleted: analytics.reduce((sum, day) => sum + day.habitsCompleted, 0),
        perfectDays: analytics.filter(day => day.completionRate === 100).length,
        totalDays: analytics.length
      }
    };
  } catch (error) {
    console.error("Error getting progress insights:", error);
    return {
      message: "Unable to generate insights at this time",
      trends: [],
      recommendations: ["Try logging some habits to see insights"]
    };
  }
};

/**
 * Get habit correlation insights
 * @param {string} userId - User ID
 */
export const getHabitCorrelationInsights = async (userId) => {
  try {
    const habits = await Habit.find({ owner: userId });
    const logs = await HabitLog.find({ owner: userId }).sort({ date: 1 });

    if (habits.length < 2 || logs.length === 0) {
      return {
        message: "Log more habits to see correlation insights",
        correlations: []
      };
    }

    // Group logs by date
    const logsByDate = {};
    logs.forEach(log => {
      if (!logsByDate[log.date]) {
        logsByDate[log.date] = [];
      }
      logsByDate[log.date].push(log.habit.toString());
    });

    // Find correlations
    const correlations = [];
    const habitIds = habits.map(h => h._id.toString());

    for (let i = 0; i < habitIds.length; i++) {
      for (let j = i + 1; j < habitIds.length; j++) {
        const habit1 = habits[i];
        const habit2 = habits[j];
        
        let sameDayCount = 0;
        let totalDays = 0;

        Object.values(logsByDate).forEach(dayHabits => {
          const hasHabit1 = dayHabits.includes(habit1._id.toString());
          const hasHabit2 = dayHabits.includes(habit2._id.toString());
          
          if (hasHabit1 || hasHabit2) {
            totalDays++;
            if (hasHabit1 && hasHabit2) {
              sameDayCount++;
            }
          }
        });

        if (totalDays > 0) {
          const correlationRate = (sameDayCount / totalDays) * 100;
          if (correlationRate > 30) {
            correlations.push({
              habit1: habit1.name,
              habit2: habit2.name,
              correlationRate: Math.round(correlationRate),
              message: `When you do "${habit1.name}", you're ${Math.round(correlationRate)}% likely to also do "${habit2.name}"`
            });
          }
        }
      }
    }

    return {
      message: correlations.length > 0 ? "Here are some habit correlations we found:" : "No strong correlations found yet",
      correlations: correlations.slice(0, 3) // Top 3 correlations
    };
  } catch (error) {
    console.error("Error getting habit correlation insights:", error);
    return {
      message: "Unable to analyze habit correlations at this time",
      correlations: []
    };
  }
}; 