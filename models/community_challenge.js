import mongoose from "mongoose";

const communityChallengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['monthly', 'weekly', 'special'],
    required: true
  },
  category: {
    type: String,
    enum: ['fitness', 'productivity', 'mindfulness', 'learning', 'general'],
    required: true
  },
  goal: {
    type: String,
    required: true
  },
  target: {
    type: Number,
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    progress: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed'],
    default: 'upcoming'
  },
  rewards: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model("CommunityChallenge", communityChallengeSchema);