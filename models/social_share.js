import mongoose from "mongoose";

const socialShareSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["streak", "achievement", "progress", "milestone"],
    required: true
  },
  platform: {
    type: String,
    enum: ["twitter", "instagram", "tiktok", "facebook", "linkedin", "snapchat"],
    required: true
  },
  content: {
    title: String,
    description: String,
    imageUrl: String,
    hashtags: [String]
  },
  metadata: {
    habitId: mongoose.Schema.Types.ObjectId,
    streakId: mongoose.Schema.Types.ObjectId,
    achievementId: mongoose.Schema.Types.ObjectId,
    streakDays: Number,
    achievementType: String
  },
  shareUrl: String,
  clicks: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Speed up lookups by user and recency
socialShareSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("SocialShare", socialShareSchema); 