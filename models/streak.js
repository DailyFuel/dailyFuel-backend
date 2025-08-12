import mongoose from "mongoose";

const streakSchema = new mongoose.Schema({
    habit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Habit',
        required: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    start_date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
    },
    end_date: {
        type: String, // Nullable; indicates if streak is ongoing
        default: null,
    },
    longest: {
        type: Boolean,
        default: false,
    }
}, {
    timestamps: true,
    versionKey: false,
});

// Common queries: by owner/habit and filter by end_date for active vs ended
streakSchema.index({ owner: 1, habit: 1, end_date: 1 });
streakSchema.index({ habit: 1, owner: 1, start_date: 1 });

const Streak = mongoose.model("Streak", streakSchema);

export default Streak;
