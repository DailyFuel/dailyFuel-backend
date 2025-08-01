// models/habitLog.js
import mongoose from "mongoose";

const habitLogSchema = new mongoose.Schema({
    habit: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Habit', 
        required: true 
    },
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    date: { 
        type: String, 
        required: true }, // Format: YYYY-MM-DD
}, {
    timestamps: true,
    versionKey: false
});

habitLogSchema.index({ 
    habit: 1, 
    date: 1, 
    owner: 1 
}, { unique: true }); // Prevent duplicate logs

const HabitLog = mongoose.model("HabitLog", habitLogSchema);

export default HabitLog;
