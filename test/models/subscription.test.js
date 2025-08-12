import mongoose from 'mongoose';
import Subscription from '../../models/subscription.js';
import { createUser } from '../helpers/factories.js';

describe('Subscription model', () => {
  beforeAll(async () => {
    await Subscription.syncIndexes();
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  test('should be defined', () => {
    expect(Subscription).toBeDefined();
    expect(Subscription.modelName).toBe('Subscription');
  });

  test('creates with default free plan', async () => {
    const user = await createUser();
    const sub = await Subscription.create({ user: user._id });
    expect(sub.plan).toBe('free');
    expect(sub.status).toBe('active');
  });

  test('enforces unique user subscription', async () => {
    const user = await createUser();
    await Subscription.create({ user: user._id });
    await expect(Subscription.create({ user: user._id })).rejects.toThrow(/duplicate key/i);
  });

  test('rejects invalid plan enum', async () => {
    const user = await createUser();
    await expect(Subscription.create({ user: user._id, plan: 'enterprise' })).rejects.toThrow();
  });
});



