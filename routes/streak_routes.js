import { Router } from "express";
import Habit from "../models/habit.js";
import HabitLog from "../models/habit_log.js";
import Streak from "../models/streak.js";
import firebaseAuth from "../src/firebase-auth.js";
import { getAllStreaks, getCurrentStreak, getStreakStats } from "../utils/streakUtils.js";
import Subscription from "../models/subscription.js";
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

        console.log(`🔍 Streak request for habit ${habitId} from user ${req.auth.id}`);

        // Confirm the habit belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            console.log(`❌ Habit ${habitId} not found or unauthorized for user ${req.auth.id}`);
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        console.log(`✅ Habit ${habitId} found:`, habit.name);

        // Check if there are any logs for this habit
        const logs = await HabitLog.find({ habit: habitId, owner: req.auth.id });
        console.log(`📊 Found ${logs.length} logs for habit ${habitId}:`, logs.map(l => l.date));

        const streak = await getCurrentStreak(req.auth.id, habitId);

        console.log(`Route handler - streak found for habit ${habitId}:`, streak);

        if (!streak) {
            console.log(`❌ No streak found for habit ${habitId}`);
            return res.status(404).send({ message: "No active streak found" });
        }

        // Calculate streak days and send milestone notification if applicable
        const startDate = dayjs(streak.start_date);
        
        // For ongoing streaks, we need to check if there are any logs for today
        // If not, the streak should end yesterday
        let endDate;
        if (streak.end_date) {
            // Completed streak
            endDate = dayjs(streak.end_date);
        } else {
            // Ongoing streak - check if there's a log for today
            const todayLog = await HabitLog.findOne({
                habit: habitId,
                owner: req.auth.id,
                date: dayjs().format('YYYY-MM-DD')
            });
            
            if (todayLog) {
                // There's a log for today, so streak continues to today
                endDate = dayjs();
            } else {
                // No log for today, so streak ends yesterday
                endDate = dayjs().subtract(1, 'day');
            }
        }
        
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

// POST validate and fix streak consistency
router.post("/validate/:habitId", firebaseAuth, async (req, res) => {
    try {
        const { habitId } = req.params;

        console.log(`🔍 Validating streak consistency for habit ${habitId} from user ${req.auth.id}`);

        // Confirm the habit belongs to the user
        const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
        if (!habit) {
            console.log(`❌ Habit ${habitId} not found or unauthorized for user ${req.auth.id}`);
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        console.log(`✅ Habit ${habitId} found:`, habit.name);

        // Import the validation function
        const { validateStreakConsistency } = await import("../utils/streakUtils.js");
        
        // Run validation and fixes
        const validationResult = await validateStreakConsistency(req.auth.id, habitId);
        
        console.log(`✅ Streak validation completed for habit ${habitId}:`, validationResult);
        
        res.send({
            message: "Streak validation completed",
            result: validationResult
        });
    } catch (err) {
        console.error(`❌ Error validating streak for habit ${req.params?.habitId}:`, err);
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