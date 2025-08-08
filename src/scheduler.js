import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import Reminder from '../models/reminder.js';
import { createNotification } from '../services/notification_service.js';
import { computeNextRunAt } from './timeUtils.js';

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

