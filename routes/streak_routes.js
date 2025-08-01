import { Router } from "express";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js";
import { auth } from "../src/auth.js";
import { getAllStreaks, getCurrentStreak, getStreakStats } from "../utils/streakUtils.js";
import { sendStreakMilestoneNotification } from "../services/notification_service.js";
import dayjs from "dayjs";

const router = Router();

// GET all streaks for a user's habit
router.get("/:habitId", auth, async (req, res) => {
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
router.get("/current/:habitId", auth, async (req, res) => {
    try {
        const { habitId } = req.params;

        // Confirm the habit belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        const streak = await getCurrentStreak(req.auth.id, habitId);

        if (!streak) {
            return res.status(404).send({ message: "No active streak found" });
        }

        // Calculate streak days and send milestone notification if applicable
        const startDate = dayjs(streak.start_date);
        const endDate = streak.end_date ? dayjs(streak.end_date) : dayjs();
        const streakDays = endDate.diff(startDate, "day") + 1;

        // Send milestone notification
        await sendStreakMilestoneNotification(req.auth.id, streakDays);

        res.send({
            ...streak.toObject(),
            streakDays
        });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// GET streak statistics for a habit
router.get("/stats/:habitId", auth, async (req, res) => {
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
router.delete("/:streakId", auth, async (req, res) => {
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
