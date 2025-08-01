import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  habitsCompleted: {
    type: Number,
    default: 0
  },
  totalHabits: {
    type: Number,
    default: 0
  },
  completionRate: {
    type: Number,
    default: 0
  },
  streaksActive: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  achievementsUnlocked: {
    type: Number,
    default: 0
  },
  timeOfDay: {
    morning: { type: Number, default: 0 },   // 6 AM - 12 PM
    afternoon: { type: Number, default: 0 }, // 12 PM - 6 PM
    evening: { type: Number, default: 0 },   // 6 PM - 12 AM
    night: { type: Number, default: 0 }      // 12 AM - 6 AM
  },
  dayOfWeek: {
    type: String,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  },
  isWeekend: {
    type: Boolean,
    default: false
  },
  mood: {
    type: String,
    enum: ["great", "good", "okay", "bad", "terrible"],
    default: "good"
  },
  notes: String
}, {
  timestamps: true
});

// Prevent duplicate daily analytics
analyticsSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("Analytics", analyticsSchema); 