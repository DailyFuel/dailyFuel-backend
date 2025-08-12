import { Router } from "express";
import dayjs from "dayjs";
import auth from "../src/auth.js";
import Subscription from "../models/subscription.js";
import StreakFreeze from "../models/streak_freeze.js";
import Habit from "../models/habit.js";

const router = Router();

// Helper to enforce monthly freeze limit
const canFreeze = async (userId) => {
  const sub = await Subscription.findOne({ user: userId });
  const isPro = sub?.plan === 'pro';
  const limit = isPro ? 2 : 0;
  if (limit === 0) return { allowed: false, limit, used: 0 };
  const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
  const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
  const used = await StreakFreeze.countDocuments({
    owner: userId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });
  return { allowed: used < limit, limit, used };
};

// POST freeze a day for a habit
router.post('/', auth, async (req, res) => {
  try {
    const { habitId, date, reason } = req.body;
    if (!habitId || !date) return res.status(400).send({ error: 'habitId and date are required' });

    // Confirm habit belongs to user
    const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
    if (!habit) return res.status(404).send({ error: 'Habit not found or unauthorized' });

    // Enforce limit
    const gate = await canFreeze(req.auth.id);
    if (!gate.allowed) {
      return res.status(403).send({
        error: 'Free tier does not include streak freeze or monthly limit reached. Upgrade to Pro to protect your streaks.',
        upgradeRequired: true,
        limit: gate.limit,
        used: gate.used,
      });
    }

    // Create freeze
    const freeze = await StreakFreeze.create({ owner: req.auth.id, habit: habitId, date, reason: reason || '' });
    res.status(201).send({ freeze });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// GET monthly freeze usage
router.get('/usage/month', auth, async (req, res) => {
  try {
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
    const used = await StreakFreeze.countDocuments({
      owner: req.auth.id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });
    const sub = await Subscription.findOne({ user: req.auth.id });
    const limit = sub?.plan === 'pro' ? 2 : 0;
    res.send({ limit, used, remaining: Math.max(0, limit - used) });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

export default router;

