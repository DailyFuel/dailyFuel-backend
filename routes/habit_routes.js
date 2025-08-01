import { Router } from "express";
import Habit from "../models/habit.js";
import { auth } from "../src/auth.js";
import { checkAchievements } from "../services/achievement_service.js";

const router = Router();

// Create a new habit for the authenticated user
router.post("/", auth, async (req, res) => {
    try {
        const { name, goal, frequency } = req.body;

        const newHabit = await Habit.create({
            name,
            goal,
            frequency,
            owner: req.auth.id,
        });

        // Check for achievements
        const achievements = await checkAchievements(req.auth.id, "habit_created");

        res.status(201).send({
            habit: newHabit,
            achievements: achievements.length > 0 ? achievements : undefined
        });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});

// Get all habits for the authenticated user
router.get("/", auth, async (req, res) => {
    try {
        const habits = await Habit.find({ owner: req.auth.id });
        res.send(habits);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Get a specific habit by ID (only if it belongs to the user)
router.get("/:id", auth, async (req, res) => {
    try {
        const habit = await Habit.findOne({
            _id: req.params.id,
            owner: req.auth.id,
        });

        if (!habit) {
            return res.status(404).send({ error: "Habit not found" });
        }

        res.send(habit);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Update a habit (only if it belongs to the user)
router.put("/:id", auth, async (req, res) => {
    try {
        const habit = await Habit.findOneAndUpdate(
            { _id: req.params.id, owner: req.auth.id },
            req.body,
            { new: true }
        );

        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        res.send(habit);
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});

// Delete a habit (only if it belongs to the user)
router.delete("/:id", auth, async (req, res) => {
    try {
        const habit = await Habit.findOneAndDelete({
            _id: req.params.id,
            owner: req.auth.id,
        });

        if (!habit) {
            return res.status(404).send({ error: "Habit not found or unauthorized" });
        }

        res.send({ message: "Habit deleted successfully" });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

export default router;
