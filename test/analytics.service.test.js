import { describe, test, expect } from '@jest/globals';
import dayjs from 'dayjs';
import { updateDailyAnalytics } from '../services/analytics_service.js';
import User from '../models/user.js';
import Habit from '../models/habit.js';
import HabitLog from '../models/habit_log.js';
import Streak from '../models/streak.js';

describe('analytics_service.updateDailyAnalytics', () => {

  test('computes completion rate and longest streak', async () => {
    const user = await User.create({ name: 'Ana', email: 'ana@example.com', password: 'StrongPass9' });
    const habit = await Habit.create({ name: 'Meditate', owner: user._id, frequency: 'daily' });

    // Logs for today
    const today = dayjs().format('YYYY-MM-DD');
    await HabitLog.create({ habit: habit._id, owner: user._id, date: today });

    // Streak from 3 calendar days ago (inclusive) to ongoing.
    // Use startOf('day') to avoid time-of-day/UTC rounding issues in containers.
    const threeDaysAgo = dayjs().startOf('day').subtract(2, 'day').toDate();
    await Streak.create({ owner: user._id, habit: habit._id, start_date: threeDaysAgo, end_date: null });

    const analytics = await updateDailyAnalytics(String(user._id), today);
    expect(analytics).toBeTruthy();
    expect(analytics.habitsCompleted).toBe(1);
    expect(analytics.totalHabits).toBe(1);
    expect(analytics.completionRate).toBe(100);
    expect(analytics.longestStreak).toBeGreaterThanOrEqual(3);
  });
});


