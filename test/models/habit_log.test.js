import mongoose from 'mongoose';
import HabitLog from '../../models/habit_log.js';
import { createHabit, createUser } from '../helpers/factories.js';

describe('HabitLog model', () => {
  beforeAll(async () => {
    await HabitLog.syncIndexes();
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  test('should be defined', () => {
    expect(HabitLog).toBeDefined();
    expect(HabitLog.modelName).toBe('HabitLog');
  });

  test('creates and saves a valid habit log', async () => {
    const user = await createUser();
    const habit = await createHabit(user._id);
    const today = new Date().toISOString().slice(0, 10);
    const log = await HabitLog.create({ habit: habit._id, owner: user._id, date: today });
    expect(log._id).toBeDefined();
    expect(log.date).toBe(today);
  });

  test('enforces unique log per habit/date/owner', async () => {
    const user = await createUser();
    const habit = await createHabit(user._id);
    const day = '2025-01-01';
    await HabitLog.create({ habit: habit._id, owner: user._id, date: day });
    await expect(
      HabitLog.create({ habit: habit._id, owner: user._id, date: day })
    ).rejects.toThrow(/duplicate key/i);
  });
});



