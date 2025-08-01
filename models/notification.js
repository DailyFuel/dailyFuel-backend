import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      "habit_reminder",      // Daily habit reminder
      "streak_milestone",    // Streak milestone reached
      "achievement_unlocked", // New achievement
      "streak_break",        // Streak about to break
      "motivation",          // Motivational message
      "social_activity",     // Friend activity
      "subscription"         // Subscription related
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  scheduledFor: {
    type: Date
  },
  platform: {
    type: String,
    enum: ["push", "email", "in_app"],
    default: "in_app"
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, scheduledFor: 1 });

export default mongoose.model("Notification", notificationSchema); 