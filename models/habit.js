import { Schema, model } from "mongoose";

const habitSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    title: {
        type: String,
        required: true,
        maxLength: 100
    },
    description: {
        type: String,
    },
    frequencyType: {
        type: String,
        enum: ['daily', 'weekly', 'custom'],
        required: true
    },
    targetDays: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

const Habit = model('Habit', habitSchema)

export default Habit