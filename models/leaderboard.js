import mongoose from "mongoose";

const leaderboardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['global', 'friends', 'category'],
    required: true
  },
  category: {
    type: String,
    enum: ['fitness', 'productivity', 'mindfulness', 'learning', 'all'],
    default: 'all'
  },
  timeFrame: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'allTime'],
    required: true
  },
  entries: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    score: {
      type: Number,
      default: 0
    },
    metric: {
      type: String,
      enum: ['streak', 'completion', 'consistency'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    rank: {
      type: Number
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  lastCalculated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
leaderboardSchema.index({ type: 1, category: 1, timeFrame: 1 });

export default mongoose.model("Leaderboard", leaderboardSchema); 