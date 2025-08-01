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
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", required: true 
    }
}, {
    timestamps: true
});

const Habit = mongoose.model("Habit", habitSchema);

export default Habit;
