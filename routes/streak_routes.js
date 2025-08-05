import { Router } from "express";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js";
import firebaseAuth from "../src/firebase-auth.js";
import { getAllStreaks, getCurrentStreak, getStreakStats } from "../utils/streakUtils.js";
import { sendStreakMilestoneNotification } from "../services/notification_service.js";
import dayjs from "dayjs";

const router = Router();

// GET all streaks for a user's habit
router.get("/:habitId", firebaseAuth, async (req, res) => {
    try {
        const { habitId } = req.params;

        // Confirm the habit belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        const streaks = await getAllStreaks(req.auth.id, habitId);
        res.send(streaks);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// GET current ongoing streak for a habit
router.get("/current/:habitId", firebaseAuth, async (req, res) => {
    try {
        const { habitId } = req.params;

        // Confirm the habit belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        const streak = await getCurrentStreak(req.auth.id, habitId);

        console.log(`Route handler - streak found for habit ${habitId}:`, streak);

        if (!streak) {
            console.log(`No streak found for habit ${habitId}`);
            return res.status(404).send({ message: "No active streak found" });
        }

        // Calculate streak days and send milestone notification if applicable
        const startDate = dayjs(streak.start_date);
        const endDate = streak.end_date ? dayjs(streak.end_date) : dayjs();
        let streakDays = endDate.diff(startDate, "day") + 1;
        
        // If the start date is in the future, set streak to 0
        if (streakDays <= 0) {
            streakDays = 0;
        }

        console.log('Date calculation details:', {
            startDateString: streak.start_date,
            startDateParsed: startDate.format('YYYY-MM-DD'),
            endDateString: streak.end_date,
            endDateParsed: endDate.format('YYYY-MM-DD'),
            diffDays: endDate.diff(startDate, "day"),
            streakDays: streakDays,
            currentDate: dayjs().format('YYYY-MM-DD')
        });

        console.log(`Streak calculation for habit ${habitId}:`, {
            startDate: streak.start_date,
            endDate: streak.end_date,
            calculatedStreakDays: streakDays,
            streakObject: streak.toObject()
        });

        // Send milestone notification
        await sendStreakMilestoneNotification(req.auth.id, streakDays);

        const response = {
            ...streak.toObject(),
            streakDays
        };
        
        console.log('Sending streak response:', response);
        res.send(response);
        console.log('Response sent successfully');
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// GET streak statistics for a habit
router.get("/stats/:habitId", firebaseAuth, async (req, res) => {
    try {
        const { habitId } = req.params;

        // Confirm the habit belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        const stats = await getStreakStats(req.auth.id, habitId);
        res.send(stats);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// DELETE a streak (if needed by admin or cleanup)
router.delete("/:streakId", firebaseAuth, async (req, res) => {
    try {
        const deleted = await Streak.findOneAndDelete({
            _id: req.params.streakId,
            owner: req.auth.id,
        });

        if (!deleted) {
            return res.status(404).send({ error: "Streak not found or unauthorized" });
        }

        res.send({ message: "Streak deleted" });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

export default router;