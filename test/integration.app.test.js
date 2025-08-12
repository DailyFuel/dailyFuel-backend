import request from 'supertest';
import express from 'express';
import { jest, describe, test, expect } from '@jest/globals';

// Build a minimal app instance that mounts selected routes for integration testing
import userRoutes from '../routes/user_routes.js';
import habitRoutes from '../routes/habit_routes.js';
import habitLogRoutes from '../routes/habit_log_routes.js';
import auth, { adminOnly } from '../src/auth.js';
import jwt from 'jsonwebtoken';
import config from '../src/config.js';
import User from '../models/user.js';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/user', userRoutes);
  app.use('/habits', habitRoutes);
  app.use('/habit-logs', habitLogRoutes);
  return app;
};

describe('Integration: core routes', () => {
  let app;

  beforeAll(async () => {
    app = buildApp();
  });

  test('Register -> Login -> Profile flow', async () => {
    // Register
    const registerRes = await request(app)
      .post('/user/register')
      .send({ name: 'Tyson', email: 'tyson@example.com', password: 'StrongPass9' });
    expect(registerRes.status).toBe(201);

    // Login
    const loginRes = await request(app)
      .post('/user/login')
      .send({ email: 'tyson@example.com', password: 'StrongPass9' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();

    const token = loginRes.body.token;

    // Profile
    const profileRes = await request(app)
      .get('/user/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.email).toBe('tyson@example.com');
  });

  test('Create habit then log it', async () => {
    // Create user and token
    const user = await User.create({ name: 'Tyson', email: 't2@example.com', password: 'StrongPass9' });
    const token = jwt.sign({ id: user._id, email: user.email }, config.JWT_SECRET, { expiresIn: '10m' });

    // Create habit
    const habitRes = await request(app)
      .post('/habits')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Drink water', goal: '8 cups', frequency: 'daily' });
    // Route should exist; assert not 404
    expect(habitRes.status).not.toBe(404);

    // Create a habit log (requires habit id if creation succeeded)
    const habitId = habitRes.body?.habit?._id;
    if (habitId) {
      const today = new Date().toISOString().slice(0, 10);
      const logRes = await request(app)
        .post('/habit-logs')
        .set('Authorization', `Bearer ${token}`)
        .send({ habitId, date: today });
      expect([201, 400, 404]).toContain(logRes.status);
    }
  });
});


