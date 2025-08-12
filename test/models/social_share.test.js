import mongoose from 'mongoose';
import SocialShare from '../../models/social_share.js';
import { createUser } from '../helpers/factories.js';

describe('SocialShare model', () => {
  beforeAll(async () => {
    await SocialShare.syncIndexes();
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  test('should be defined', () => {
    expect(SocialShare).toBeDefined();
    expect(SocialShare.modelName).toBe('SocialShare');
  });

  test('creates a valid social share', async () => {
    const user = await createUser();
    const s = await SocialShare.create({
      user: user._id,
      type: 'streak',
      platform: 'twitter',
    });
    expect(s._id).toBeDefined();
    expect(s.platform).toBe('twitter');
  });
});



