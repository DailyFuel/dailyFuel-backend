import mongoose from 'mongoose';
import Notification from '../../models/notification.js';
import { createUser } from '../helpers/factories.js';

describe('Notification model', () => {
  beforeAll(async () => {
    await Notification.syncIndexes();
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  test('should be defined', () => {
    expect(Notification).toBeDefined();
    expect(Notification.modelName).toBe('Notification');
  });

  test('creates a valid notification', async () => {
    const user = await createUser();
    const n = await Notification.create({
      user: user._id,
      type: 'motivation',
      title: 'Stay hydrated',
      message: 'Drink water today!',
    });
    expect(n._id).toBeDefined();
    expect(n.read).toBe(false);
  });

  test('rejects invalid type enum', async () => {
    const user = await createUser();
    await expect(
      Notification.create({ user: user._id, type: 'unknown', title: 't', message: 'm' })
    ).rejects.toThrow();
  });
});



