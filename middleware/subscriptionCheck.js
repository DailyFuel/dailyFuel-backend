import Subscription from "../models/subscription.js";
import Habit from "../models/habit.js";
import SocialShare from "../models/social_share.js";

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
    const proFeatures = ['advanced_analytics', 'smart_insights', 'custom_reminders', 'unlimited_habits', 'unlimited_sharing'];
    
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
    
    req.subscriptionStatus = {
      plan: subscription?.plan || 'free',
      status: subscription?.status || 'active',
      limits: {
        habits: {
          limit: subscription?.plan === 'pro' ? -1 : 3, // -1 means unlimited
          current: habitCount,
          remaining: subscription?.plan === 'pro' ? -1 : Math.max(0, 3 - habitCount)
        },
        socialSharing: {
          limit: subscription?.plan === 'pro' ? -1 : 3,
          current: dailyShareCount,
          remaining: subscription?.plan === 'pro' ? -1 : Math.max(0, 3 - dailyShareCount)
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