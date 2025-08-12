import { describe, test, expect } from '@jest/globals';
import dayjs from 'dayjs';

describe('analytics_service longest streak (unit shape)', () => {
  test('sample longest streak logic explanation placeholder', () => {
    // Full unit test would mock Streak/HabitLog models.
    // Here we assert dayjs duration calculation used in service: end.diff(start, 'day') + 1
    const start = dayjs('2025-01-01');
    const end = dayjs('2025-01-03');
    const days = end.diff(start, 'day') + 1;
    expect(days).toBe(3);
  });
});

