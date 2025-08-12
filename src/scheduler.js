import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import cron from 'node-cron';
import Reminder from '../models/reminder.js';
import { createNotification } from '../services/notification_service.js';
import { ensureDailyInsight } from '../services/insights_service.js';
import { getLLM } from '../services/llm_provider.js';
import Subscription from '../models/subscription.js';
import { computeNextRunAt } from './timeUtils.js';
import Habit from '../models/habit.js';
import HabitLog from '../models/habit_log.js';
import Streak from '../models/streak.js';
import { MISSED_DAYS_BREAKS_STREAK } from '../utils/streakConstants.js';

// Runs every minute to check for reminders scheduled at current minute
dayjs.extend(utc);
dayjs.extend(timezone);

export const startReminderScheduler = () => {
  dayjs.extend(utc); dayjs.extend(timezone);
  // Reminders: every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 30 * 1000);
      const due = await Reminder.find({ enabled: true, nextRunAt: { $gte: windowStart, $lte: now } })
        .sort({ nextRunAt: 1 }).limit(500);
      for (const r of due) {
        await createNotification(r.owner, 'habit_reminder', { title: 'Reminder', message: 'Time for your habit', platform: 'push', habitId: r.habit });
        const nextAt = computeNextRunAt(r.time, r.daysOfWeek || [], r.timezone || 'UTC', now);
        await Reminder.updateOne({ _id: r._id }, { $set: { nextRunAt: nextAt } });
      }
    } catch (err) { console.error('reminder cron error', err); }
  });

  // Deep insights: at minute 5 of every hour
  cron.schedule('5 * * * *', async () => {
    try {
      const proUsers = await Subscription.find({ $or: [ { plan: 'pro' }, { trial_active: true } ] }).select('user');
      const llm = getLLM();
      for (const s of proUsers) {
        try { await ensureDailyInsight(s.user, llm); } catch (e) { console.warn('ensureDailyInsight failed for', s.user?.toString?.(), e?.message); }
      }
    } catch (err) { console.error('deep insights cron error', err); }
  });

  // Streak closure: daily at 03:10
  cron.schedule('10 3 * * *', async () => {
    try {
      const now = new Date();
      const users = await Habit.find().distinct('owner');
      for (const userId of users) {
        const habits = await Habit.find({ owner: userId }).select('_id');
        for (const h of habits) {
          try {
            const lastLog = await HabitLog.findOne({ owner: userId, habit: h._id }).sort({ date: -1 }).select('date');
            if (!lastLog) continue;
            const daysGap = Math.floor((now - new Date(lastLog.date)) / (24*60*60*1000));
            if (daysGap >= MISSED_DAYS_BREAKS_STREAK) {
              await Streak.updateMany({ owner: userId, habit: h._id, end_date: null }, { $set: { end_date: lastLog.date } });
            }
          } catch (e) { console.warn('streak close failed', userId?.toString?.(), h?._id?.toString?.(), e?.message); }
        }
      }
    } catch (err) { console.error('streak close cron error', err); }
  });
};

