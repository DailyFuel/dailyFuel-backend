import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import Reminder from '../models/reminder.js';
import { createNotification } from '../services/notification_service.js';
import { ensureDailyInsight } from '../services/insights_service.js';
import { getLLM } from '../services/llm_provider.js';
import Subscription from '../models/subscription.js';
import { computeNextRunAt } from './timeUtils.js';
import Habit from '../models/habit.js';
import HabitLog from '../models/habit_log.js';
import Streak from '../models/streak.js';

// Runs every minute to check for reminders scheduled at current minute
dayjs.extend(utc);
dayjs.extend(timezone);

export const startReminderScheduler = () => {
  let running = false;
  const TICK_MS = 15_000; // 15s granularity keeps load low and avoids exact-minute drift warnings

  const tick = async () => {
    if (running) return; // prevent overlap
    running = true;
    try {
      const now = new Date();
      // Check a 30s window to tolerate small delays without duplicates
      const windowStart = new Date(now.getTime() - 30 * 1000);
      const due = await Reminder.find({ enabled: true, nextRunAt: { $gte: windowStart, $lte: now } })
        .sort({ nextRunAt: 1 })
        .limit(500);

      for (const r of due) {
        await createNotification(r.owner, 'habit_reminder', {
          title: 'Reminder',
          message: `Time for your habit`,
          platform: 'push',
          habitId: r.habit,
        });
        const nextAt = computeNextRunAt(r.time, r.daysOfWeek || [], r.timezone || 'UTC', now);
        await Reminder.updateOne({ _id: r._id }, { $set: { nextRunAt: nextAt } });
      }

      // Once per hour: opportunistically generate/cached deep insights for Pro or trial users
      if (now.getMinutes() === 5) { // run around HH:05 to avoid heavy minute
        const since = new Date(now.getTime() - 2 * 60 * 60 * 1000); // avoid redoing inside 2h window
        const proUsers = await Subscription.find({ $or: [ { plan: 'pro' }, { trial_active: true } ] }).select('user');
        const llm = getLLM();
        for (const s of proUsers) {
          try { await ensureDailyInsight(s.user, llm); } catch (e) { console.warn('ensureDailyInsight failed for', s.user?.toString?.(), e?.message); }
        }
      }

      // Once per day at ~03:10, close ongoing streaks if the user missed 2+ days
      if (now.getHours() === 3 && now.getMinutes() === 10) {
        const users = await Habit.find().distinct('owner');
        for (const userId of users) {
          const habits = await Habit.find({ owner: userId }).select('_id');
          const todayStr = new Date().toISOString().slice(0,10);
          for (const h of habits) {
            try {
              const lastLog = await HabitLog.findOne({ owner: userId, habit: h._id }).sort({ date: -1 }).select('date');
              if (!lastLog) continue;
              const daysGap = Math.floor((now - new Date(lastLog.date)) / (24*60*60*1000));
              if (daysGap >= 2) {
                // Close any ongoing streak
                await Streak.updateMany({ owner: userId, habit: h._id, end_date: null }, { $set: { end_date: lastLog.date } });
              }
            } catch (e) { console.warn('streak close failed', userId?.toString?.(), h?._id?.toString?.(), e?.message); }
          }
        }
      }
    } catch (err) {
      console.error('Reminder scheduler error:', err);
    } finally {
      running = false;
    }
  };

  // Start interval loop
  setInterval(tick, TICK_MS);
  // Run an immediate initial tick after small delay
  setTimeout(tick, 2_000);
};

