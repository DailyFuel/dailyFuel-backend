import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../../models/user.js';

describe('User model', () => {
  beforeAll(async () => {
    // Ensure indexes are in place for unique/email validations
    await User.syncIndexes();
  });

  afterEach(async () => {
    // Clean between tests (global cleanup also runs, this is explicit for clarity)
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  describe('schema definition', () => {
    test('should be defined', () => {
      expect(User).toBeDefined();
      expect(User.modelName).toBe('User');
    });
  });

  describe('creation and validation', () => {
    test('creates and saves a valid user', async () => {
      const valid = new User({
        name: 'Tyson',
        email: 'tyson@example.com',
        password: 'StrongPass9',
      });
      const saved = await valid.save();
      expect(saved._id).toBeDefined();
      expect(saved.email).toBe('tyson@example.com');
      expect(saved.authProvider).toBe('password');
    });

    test('throws error for invalid email format', async () => {
      const invalid = new User({
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'StrongPass9',
      });
      await expect(invalid.save()).rejects.toThrow(/valid email/i);
    });

    test('enforces password strength for password auth', async () => {
      const weak = new User({
        name: 'Weak Pwd',
        email: 'weak@example.com',
        password: 'password',
      });
      await expect(weak.save()).rejects.toThrow(/upper\/lowercase letter and a number/i);
    });

    test('allows firebase auth without password', async () => {
      const firebaseUser = new User({
        authProvider: 'firebase',
        name: 'Firebase User',
        email: 'fb@example.com',
      });
      const saved = await firebaseUser.save();
      expect(saved._id).toBeDefined();
      expect(saved.authProvider).toBe('firebase');
    });

    test('enforces unique email', async () => {
      await User.create({ name: 'Alice', email: 'dup@example.com', password: 'StrongPass9' });
      await expect(
        User.create({ name: 'Bob', email: 'dup@example.com', password: 'StrongPass9' })
      ).rejects.toThrow(/duplicate key/i);
    });
  });
});
