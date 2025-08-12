import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema({
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
  time: {
    type: String, // ISO time string e.g. "08:00"
    required: true,
  },
  daysOfWeek: {
    type: [Number], // 0-6 (Sun-Sat); optional for custom schedules
    default: [],
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  type: {
    type: String,
    enum: ["basic", "smart"],
    default: "basic",
  },
  timezone: {
    type: String, // IANA timezone like "America/New_York"
    default: 'UTC',
  },
  nextRunAt: {
    type: Date,
    index: true,
    default: null,
  },
}, {
  timestamps: true,
});

// Helpful index for due reminders
reminderSchema.index({ enabled: 1, nextRunAt: 1 });

reminderSchema.index({ owner: 1, habit: 1 });

export default mongoose.model("Reminder", reminderSchema);

