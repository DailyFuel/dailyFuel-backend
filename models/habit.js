// models/habit.js
import mongoose from "mongoose";

const habitSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    goal: { 
        type: String 
    },
    frequency: { 
        type: String // e.g. "daily", "weekly"
    },
    category: {
        type: String,
        default: 'other'
    },
    why: {
        type: String // Personal motivation/why statement
    },
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", required: true 
    }
}, {
    timestamps: true
});

// Query optimization: list habits by owner
habitSchema.index({ owner: 1 });

const Habit = mongoose.model("Habit", habitSchema);

export default Habit;
