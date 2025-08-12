import mongoose from "mongoose";

const achievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      "streak_milestone",    // 7, 30, 100 day streaks
      "habit_master",        // Completed 10, 50, 100 habits
      "consistency_king",    // Perfect week, month
      "social_butterfly",    // Shared 5, 10, 20 times
      "early_bird",          // Logged habits before 8 AM
      "night_owl",           // Logged habits after 10 PM
      "weekend_warrior",     // Logged on weekends
      "first_habit",         // Created first habit
      "first_log",           // Logged first habit
      "referral_master"      // Referred 5, 10, 20 users
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: "🏆"
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Prevent duplicate achievements
achievementSchema.index({ user: 1, type: 1 }, { unique: true });

export default mongoose.model("Achievement", achievementSchema); 