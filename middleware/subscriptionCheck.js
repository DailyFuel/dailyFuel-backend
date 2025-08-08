import Subscription from "../models/subscription.js";
import Habit from "../models/habit.js";
import SocialShare from "../models/social_share.js";
import Reminder from "../models/reminder.js";
import StreakFreeze from "../models/streak_freeze.js";
import dayjs from "dayjs";
import { trackEvent } from "../services/event_service.js";

/**
 * Check if user has reached free tier habit limit
 */
export const checkFreeTierHabitLimit = async (req, res, next) => {
  try {
    const user = req.auth.id;
    const subscription = await Subscription.findOne({ user });
    
    // If user has pro plan, allow unlimited habits
    if (subscription?.plan === 'pro') {
      return next();
    }
    
    // For free users, check habit count
    const habitCount = await Habit.countDocuments({ owner: user });
    if (habitCount >= 3) {
      // Track cap hit (non-blocking)
      try {
        trackEvent(user, 'cap_hit', {
          type: 'habit_limit',
          limit: 3,
          current: habitCount
        });
      } catch {}
      return res.status(403).json({ 
        error: 'Free tier limit reached. You can create up to 3 habits. Upgrade to Pro for unlimited habits.',
        limit: 3,
        current: habitCount,
        upgradeRequired: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking habit limit:', error);
    res.status(500).json({ error: 'Failed to check subscription limits' });
  }
};

/**
 * Check if user has reached free tier social sharing limit
 */
export const checkFreeTierSocialLimit = async (req, res, next) => {
  try {
    const user = req.auth.id;
    const subscription = await Subscription.findOne({ user });
    
    // If user has pro plan, allow unlimited sharing
    if (subscription?.plan === 'pro') {
      return next();
    }
    
    // For free users, check daily share count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyShareCount = await SocialShare.countDocuments({ 
      user: user,
      createdAt: { $gte: today }
    });
    
    if (dailyShareCount >= 3) {
      // Track cap hit (non-blocking)
      try {
        trackEvent(user, 'cap_hit', {
          type: 'social_share_limit',
          limit: 3,
          current: dailyShareCount
        });
      } catch {}
      return res.status(403).json({ 
        error: 'Free tier limit reached. You can share up to 3 times per day. Upgrade to Pro for unlimited sharing.',
        limit: 3,
        current: dailyShareCount,
        upgradeRequired: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking social sharing limit:', error);
    res.status(500).json({ error: 'Failed to check social sharing limits' });
  }
};

/**
 * Check feature access based on subscription
 */
export const checkFeatureAccess = (feature) => async (req, res, next) => {
  try {
    const user = req.auth.id;
    const subscription = await Subscription.findOne({ user });
    
    const freeFeatures = ['basic_analytics', 'basic_social_sharing', 'basic_habit_tracking'];
    const proFeatures = ['advanced_analytics', 'smart_insights', 'custom_reminders', 'unlimited_habits', 'unlimited_sharing', 'streak_freeze'];
    
    // If feature requires pro and user is on free plan
    if (proFeatures.includes(feature) && subscription?.plan !== 'pro') {
      return res.status(403).json({ 
        error: `This feature requires a Pro subscription. Upgrade to access ${feature.replace('_', ' ')}.`,
        feature: feature,
        upgradeRequired: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
};

/**
 * Get user's subscription status and limits
 */
export const getUserSubscriptionStatus = async (req, res, next) => {
  try {
    const user = req.auth.id;
    
    // Get subscription with error handling
    let subscription;
    try {
      subscription = await Subscription.findOne({ user });
    } catch (error) {
      console.error('Error finding subscription:', error);
      subscription = null;
    }
    
    // Get current usage with error handling
    let habitCount = 0;
    try {
      habitCount = await Habit.countDocuments({ owner: user });
    } catch (error) {
      console.error('Error counting habits:', error);
    }
    
    let dailyShareCount = 0;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dailyShareCount = await SocialShare.countDocuments({ 
        user: user,
        createdAt: { $gte: today }
      });
    } catch (error) {
      console.error('Error counting social shares:', error);
    }

    // Count reminders per habit and total
    let reminderCounts = { total: 0, byHabit: {} };
    try {
      const reminders = await Reminder.find({ owner: user });
      reminderCounts.total = reminders.length;
      for (const r of reminders) {
        const key = r.habit.toString();
        reminderCounts.byHabit[key] = (reminderCounts.byHabit[key] || 0) + 1;
      }
    } catch (error) {
      console.error('Error counting reminders:', error);
    }

    // Calculate current streak-freeze usage for this month
    let monthlyFreezeUsed = 0;
    try {
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
      monthlyFreezeUsed = await StreakFreeze.countDocuments({
        owner: user,
        date: { $gte: startOfMonth, $lte: endOfMonth },
      });
    } catch (error) {
      console.error('Error counting streak freezes:', error);
    }
    
    const plan = subscription?.plan || 'free';
    req.subscriptionStatus = {
      plan,
      status: subscription?.status || 'active',
      limits: {
        habits: {
          limit: plan === 'pro' ? -1 : 3, // -1 means unlimited
          current: habitCount,
          remaining: plan === 'pro' ? -1 : Math.max(0, 3 - habitCount)
        },
        socialSharing: {
          limit: plan === 'pro' ? -1 : 3,
          current: dailyShareCount,
          remaining: plan === 'pro' ? -1 : Math.max(0, 3 - dailyShareCount)
        },
        remindersPerHabit: {
          limit: plan === 'pro' ? -1 : 1,
          currentByHabit: reminderCounts.byHabit,
          // remaining computed client-side per habit using limit - currentByHabit[habitId]
        },
        historyWindowDays: {
          limit: plan === 'pro' ? -1 : 30
        },
        streakFreezePerMonth: {
          limit: plan === 'pro' ? 2 : 0,
          used: monthlyFreezeUsed,
          remaining: Math.max(0, (plan === 'pro' ? 2 : 0) - monthlyFreezeUsed)
        }
      }
    };
    
    next();
  } catch (error) {
    console.error('Error getting subscription status:', error);
    // Set default values even on error
    req.subscriptionStatus = {
      plan: 'free',
      status: 'active',
      limits: {
        habits: {
          limit: 3,
          current: 0,
          remaining: 3
        },
        socialSharing: {
          limit: 3,
          current: 0,
          remaining: 3
        }
      }
    };
    next();
  }
}; 