import mongoose from "mongoose";

const streakFreezeSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  habit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Habit",
    required: true,
    index: true,
  },
  date: {
    type: String, // YYYY-MM-DD for the day being frozen
    required: true,
    index: true,
  },
  reason: {
    type: String,
    default: "",
  },
}, { timestamps: true });

streakFreezeSchema.index({ owner: 1, date: 1 });

export default mongoose.model("StreakFreeze", streakFreezeSchema);

