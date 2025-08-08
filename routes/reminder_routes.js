import { Router } from "express";
import auth from "../src/auth.js";
import Reminder from "../models/reminder.js";
import Subscription from "../models/subscription.js";
import { computeNextRunAt } from "../src/timeUtils.js";

const router = Router();

// Helper: enforce reminder limit (1 per habit on free)
const enforceReminderLimit = async (userId, habitId) => {
  const subscription = await Subscription.findOne({ user: userId });
  const isPro = subscription?.plan === 'pro';
  if (isPro) return { allowed: true };
  const count = await Reminder.countDocuments({ owner: userId, habit: habitId });
  if (count >= 1) {
    return {
      allowed: false,
      error: 'Free tier limit reached. You can set 1 reminder per habit. Upgrade to Pro for multiple reminders.'
    };
  }
  return { allowed: true };
};

// Create reminder
router.post('/', auth, async (req, res) => {
  try {
    const { habitId, time, daysOfWeek, type, timezone } = req.body;
    // Smart reminders are Pro-only
    const sub = await Subscription.findOne({ user: req.auth.id });
    const isPro = sub?.plan === 'pro';
    if (type === 'smart' && !isPro) {
      return res.status(403).json({ upgradeRequired: true, error: 'Smart reminders are a Pro feature. Upgrade to enable smart reminders.' });
    }
    const gate = await enforceReminderLimit(req.auth.id, habitId);
    if (!gate.allowed) return res.status(403).json({ upgradeRequired: true, error: gate.error });

    const reminder = await Reminder.create({
      owner: req.auth.id,
      habit: habitId,
      time,
      daysOfWeek: daysOfWeek || [],
      type: type || 'basic',
      timezone: timezone || req.headers['x-timezone'] || 'UTC',
      nextRunAt: computeNextRunAt(time, daysOfWeek || [], timezone || req.headers['x-timezone'] || 'UTC'),
    });
    res.status(201).send(reminder);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// List reminders for a habit
router.get('/habit/:habitId', auth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ owner: req.auth.id, habit: req.params.habitId });
    res.send(reminders);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Update reminder
router.put('/:id', auth, async (req, res) => {
  try {
    // Prevent upgrading to smart type on free
    if (req.body?.type === 'smart') {
      const sub = await Subscription.findOne({ user: req.auth.id });
      if (sub?.plan !== 'pro') {
        return res.status(403).json({ upgradeRequired: true, error: 'Smart reminders are a Pro feature. Upgrade to enable smart reminders.' });
      }
    }
    const payload = { ...req.body };
    if (typeof payload.time !== 'undefined' || typeof payload.daysOfWeek !== 'undefined' || typeof payload.timezone !== 'undefined') {
      const t = payload.time ?? undefined;
      const d = payload.daysOfWeek ?? undefined;
      const z = payload.timezone ?? undefined;
      const current = await Reminder.findOne({ _id: req.params.id, owner: req.auth.id });
      if (current) {
        const timeVal = t ?? current.time;
        const daysVal = d ?? current.daysOfWeek;
        const tzVal = z ?? current.timezone;
        payload.nextRunAt = computeNextRunAt(timeVal, daysVal || [], tzVal || 'UTC');
      }
    }
    const updated = await Reminder.findOneAndUpdate(
      { _id: req.params.id, owner: req.auth.id },
      payload,
      { new: true }
    );
    if (!updated) return res.status(404).send({ error: 'Reminder not found' });
    res.send(updated);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Delete reminder
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Reminder.findOneAndDelete({ _id: req.params.id, owner: req.auth.id });
    if (!deleted) return res.status(404).send({ error: 'Reminder not found' });
    res.send({ message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

export default router;

