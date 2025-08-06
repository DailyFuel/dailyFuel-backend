import { Router } from "express";
import HabitLog from "../models/habit_log.js";
import Habit from "../models/habit.js";
import Streak from "../models/streak.js"
import auth from "../src/auth.js";
import { updateStreaks, updateStreaksAfterUndo } from "../utils/streakUtils.js"
import { checkAchievements } from "../services/achievement_service.js";
import { updateDailyAnalytics } from "../services/analytics_service.js";
import { sendAchievementNotification } from "../services/notification_service.js";
import dayjs from "dayjs";

const router = Router();

// Create a new log entry for a habit
router.post("/", auth, async (req, res) => {
    try {
        const { habitId, date } = req.body;

        console.log(`📝 Creating log for habit ${habitId} on date ${date} for user ${req.auth.id}`);

        // Ensure the habit exists and belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            console.log(`❌ Habit ${habitId} not found or unauthorized for user ${req.auth.id}`);
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        console.log(`✅ Habit ${habitId} found:`, habit.name);

        // Check if log already exists for the date
        const existingLog = await HabitLog.findOne({
            habit: habitId,
            date: new Date(date).toISOString().slice(0, 10),
            owner: req.auth.id
        });

        if (existingLog) {
            console.log(`⚠️ Log already exists for habit ${habitId} on date ${date}`);
            return res.status(400).send({ error: "Log already exists for this date" });
        }

        const log = await HabitLog.create({
            habit: habitId,
            date: new Date(date).toISOString().slice(0, 10),
            owner: req.auth.id,
        });

        console.log(`✅ Log created for habit ${habitId}:`, log);

        // Update streaks
        console.log(`🔄 Updating streaks for habit ${habitId}...`);
        const updatedStreaks = await updateStreaks(req.auth.id, habitId)
        console.log(`✅ Streaks updated for habit ${habitId}`);

        // Get the current streak for the response
        const currentStreak = await Streak.findOne({
            habit: habitId,
            owner: req.auth.id,
            end_date: null
        });

        // Calculate streak days for the response
        let streakDays = 0;
        if (currentStreak) {
            const startDate = dayjs(currentStreak.start_date);
            const endDate = currentStreak.end_date ? dayjs(currentStreak.end_date) : dayjs();
            streakDays = endDate.diff(startDate, "day") + 1;
        }

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
          achievements: achievements.length > 0 ? achievements : undefined,
          streak: currentStreak ? {
            id: currentStreak._id,
            start_date: currentStreak.start_date,
            end_date: currentStreak.end_date,
            streakDays: streakDays,
            isCurrent: currentStreak.end_date === null
          } : null,
          updatedStreaks: updatedStreaks.length
        });
    } catch (err) {
        console.error(`❌ Error creating log for habit ${req.body?.habitId}:`, err);
        res.status(400).send({ error: err.message });
    }
});

// Get all logs for a specific habit
router.get("/habit/:habitId", auth, async (req, res) => {
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
router.get("/today", auth, async (req, res) => {
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
router.post("/undo/:habitId", auth, async (req, res) => {
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

        // Update streaks after deletion using the more conservative approach
        const updatedStreaks = await updateStreaksAfterUndo(req.auth.id, habitId);

        // Get the current streak for the response
        const currentStreak = await Streak.findOne({
            habit: habitId,
            owner: req.auth.id,
            end_date: null
        });

        // Calculate streak days for the response
        let streakDays = 0;
        if (currentStreak) {
            const startDate = dayjs(currentStreak.start_date);
            const endDate = currentStreak.end_date ? dayjs(currentStreak.end_date) : dayjs();
            streakDays = endDate.diff(startDate, "day") + 1;
            
            console.log('Streak calculation for response:', {
                start_date: currentStreak.start_date,
                end_date: currentStreak.end_date,
                startDate: startDate.format('YYYY-MM-DD'),
                endDate: endDate.format('YYYY-MM-DD'),
                streakDays: streakDays,
                isCurrent: currentStreak.end_date === null
            });
        }

        console.log('Final streak for undo response:', currentStreak ? {
            id: currentStreak._id,
            start_date: currentStreak.start_date,
            end_date: currentStreak.end_date,
            streakDays: streakDays,
            isCurrent: currentStreak.end_date === null
        } : null);

        res.send({ 
            message: "Habit undone successfully",
            deletedLog,
            streak: currentStreak ? {
                id: currentStreak._id,
                start_date: currentStreak.start_date,
                end_date: currentStreak.end_date,
                streakDays: streakDays,
                isCurrent: currentStreak.end_date === null
            } : null,
            updatedStreaks: updatedStreaks.length
        });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Optional: Delete a specific log
router.delete("/:id", auth, async (req, res) => {
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