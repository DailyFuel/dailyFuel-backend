import { Router } from "express";
import HabitLog from "../models/habit_log.js";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js"
import firebaseAuth from "../src/firebase-auth.js";
import { updateStreaks } from "../utils/streakUtils.js"
import { checkAchievements } from "../services/achievement_service.js";
import { updateDailyAnalytics } from "../services/analytics_service.js";
import { sendAchievementNotification } from "../services/notification_service.js";
import dayjs from "dayjs";

const router = Router();

// Create a new log entry for a habit
router.post("/", firebaseAuth, async (req, res) => {
    try {
        const { habitId, date } = req.body;

        // Ensure the habit exists and belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        // Check if log already exists for the date
        const existingLog = await HabitLog.findOne({
            habit: habitId,
            date: new Date(date).toISOString().slice(0, 10),
            owner: req.auth.id
        });

        if (existingLog) {
            return res.status(400).send({ error: "Log already exists for this date" });
        }

        const log = await HabitLog.create({
            habit: habitId,
            date: new Date(date).toISOString().slice(0, 10),
            owner: req.auth.id,
        });

        // Update streaks
        await updateStreaks(req.auth.id, habitId)

        // Update analytics
        const today = dayjs().format("YYYY-MM-DD");
        await updateDailyAnalytics(req.auth.id, today);

        // Check for achievements
        const achievements = await checkAchievements(req.auth.id, "habit_logged", {
          logTime: new Date(),
          habitId
        });

        // Send notifications for new achievements
        for (const achievement of achievements) {
          await sendAchievementNotification(req.auth.id, achievement);
        }

        res.status(201).send({
          log,
          achievements: achievements.length > 0 ? achievements : undefined
        });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});

// Get all logs for a specific habit
router.get("/habit/:habitId", firebaseAuth, async (req, res) => {
    try {
        const logs = await HabitLog.find({
            habit: req.params.habitId,
            owner: req.auth.id,
        }).sort({ date: -1 });

        res.send(logs);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Get today's logs for the user
router.get("/today", firebaseAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const logs = await HabitLog.find({
            owner: req.auth.id,
            date: today
        });

        res.send(logs);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Undo a habit completion and update streaks
router.post("/undo/:habitId", firebaseAuth, async (req, res) => {
    try {
        const { habitId } = req.params;
        const today = new Date().toISOString().slice(0, 10);

        // Find and delete today's log for this habit
        const deletedLog = await HabitLog.findOneAndDelete({
            habit: habitId,
            date: today,
            owner: req.auth.id
        });

        if (!deletedLog) {
            return res.status(404).send({ error: "No log found for today" });
        }

        // Update streaks after deletion
        await updateStreaks(req.auth.id, habitId);

        res.send({ 
            message: "Habit undone successfully",
            deletedLog
        });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Optional: Delete a specific log
router.delete("/:id", firebaseAuth, async (req, res) => {
    try {
        const log = await HabitLog.findOneAndDelete({
            _id: req.params.id,
            owner: req.auth.id,
        });

        if (!log) {
            return res.status(404).send({ error: "Log not found or unauthorized" });
        }

        res.send({ message: "Log deleted" });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

export default router;