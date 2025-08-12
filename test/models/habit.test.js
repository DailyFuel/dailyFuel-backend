import mongoose from 'mongoose';
import Habit from '../../models/habit.js';
import { createUser } from '../helpers/factories.js';

describe('Habit model', () => {
  beforeAll(async () => {
    await Habit.syncIndexes();
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  test('should be defined', () => {
    expect(Habit).toBeDefined();
    expect(Habit.modelName).toBe('Habit');
  });

  test('creates and saves a valid habit', async () => {
    const user = await createUser();
    const habit = await Habit.create({ name: 'Read', owner: user._id });
    expect(habit._id).toBeDefined();
    expect(habit.name).toBe('Read');
    expect(habit.category).toBe('other');
  });

  test('requires name and owner', async () => {
    await expect(Habit.create({ name: 'No Owner' })).rejects.toThrow();
    await expect(Habit.create({ owner: new mongoose.Types.ObjectId() })).rejects.toThrow();
  });
});



