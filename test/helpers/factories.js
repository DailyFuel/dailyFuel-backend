import mongoose from 'mongoose';
import User from '../../models/user.js';
import Habit from '../../models/habit.js';

export const objectId = () => new mongoose.Types.ObjectId();

export async function createUser(overrides = {}) {
  const base = {
    name: 'Test User',
    email: `user_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
    password: 'StrongPass9',
    ...overrides,
  };
  const user = await User.create(base);
  return user;
}

export async function createHabit(ownerId, overrides = {}) {
  const owner = ownerId || (await createUser())._id;
  const base = {
    name: 'Drink Water',
    goal: '8 cups',
    frequency: 'daily',
    owner,
    ...overrides,
  };
  const habit = await Habit.create(base);
  return habit;
}



