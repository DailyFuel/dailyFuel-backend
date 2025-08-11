console.log('=== BACKEND STARTING ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Process ID:', process.pid);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser'

import { connect, disconnect } from './db.js';
import user_routes from '../routes/user_routes.js'
import habit_routes from '../routes/habit_routes.js'
import habit_log_routes from '../routes/habit_log_routes.js'
import streak_routes from '../routes/streak_routes.js'
import affiliate_routes from '../routes/affiliate_routes.js'
import referral_routes from '../routes/referral_routes.js'
import subscription_routes from '../routes/subscription_routes.js'
import social_routes from '../routes/social_routes.js'
import achievement_routes from '../routes/achievement_routes.js'
import event_routes from '../routes/event_routes.js'
import notification_routes from '../routes/notification_routes.js'
import analytics_routes from '../routes/analytics_routes.js'
import friend_routes from '../routes/friend_routes.js'
import leaderboard_routes from '../routes/leaderboard_routes.js'
import community_challenge_routes from '../routes/community_challenge_routes.js'
import streak_freeze_routes from '../routes/streak_freeze_routes.js'
import reminder_routes from '../routes/reminder_routes.js'
import push_routes from '../routes/push_routes.js'
import { startReminderScheduler } from './scheduler.js'
import webhook_routes from '../routes/webhook_routes.js'
import billing_routes from '../routes/billing_routes.js'
import dotenv from 'dotenv'
dotenv.config()

const app = express();
const port = process.env.PORT;

// Webhooks must be mounted BEFORE any body parsers
app.use('/webhooks', webhook_routes)

// Security middleware
app.use(cors());
app.use(helmet())

app.use(express.json())
app.use(cookieParser())

// Debug: Log route imports
console.log('Friend routes imported:', !!friend_routes);
console.log('Leaderboard routes imported:', !!leaderboard_routes);
console.log('Community challenge routes imported:', !!community_challenge_routes);

// Simple test route - add this AFTER app is initialized
app.get('/ping', (req, res) => {
  res.json({ 
    message: 'Pong!', 
    timestamp: new Date().toISOString(),
    pid: process.pid 
  });
});

// Routes with proper prefixes
app.use('/user', user_routes)
app.use('/habits', habit_routes)
app.use('/habit-logs', habit_log_routes)
app.use('/streaks', streak_routes)
app.use('/affiliate', affiliate_routes)
app.use('/referral', referral_routes)
app.use('/subscription', subscription_routes)
app.use('/billing', billing_routes)
app.use('/social', social_routes)
app.use('/achievements', achievement_routes)
app.use('/notifications', notification_routes)
app.use('/analytics', analytics_routes)
app.use('/events', event_routes)
app.use('/friends', friend_routes)
app.use('/leaderboard', leaderboard_routes)
app.use('/community-challenges', community_challenge_routes)
app.use('/reminders', reminder_routes)
app.use('/streak-freeze', streak_freeze_routes)
app.use('/push', push_routes)

// Test routes directly in main file
app.get('/test-friends', (req, res) => {
  res.json({ message: 'Test friends route works' });
});

app.get('/test-friends/challenges', (req, res) => {
  res.json({ message: 'Test friends challenges route works' });
});

// Test endpoint for debugging
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Backend is running',
        routes: [
            '/friends/challenges',
            '/friends/friends', 
            '/leaderboard/global/weekly',
            '/community-challenges/active'
        ]
    });
});

// Debug endpoint to test authentication
app.get('/debug/auth', (req, res) => {
  const authHeader = req.headers.authorization;
  console.log('Auth header:', authHeader);
  
  if (!authHeader) {
    return res.json({ 
      error: 'No authorization header',
      headers: req.headers
    });
  }
  
  res.json({ 
    message: 'Auth header received',
    authHeader: authHeader.substring(0, 20) + '...',
    headers: Object.keys(req.headers)
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.url
  });
});

// Start server
const startServer = async () => {
  try {
    await connect();
    // Start background schedulers only after DB is connected
    startReminderScheduler();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log('Available routes:');
      console.log('- GET /ping');
      console.log('- GET /test');
      console.log('- GET /debug/auth');
      console.log('- GET /test-friends');
      console.log('- GET /test-friends/challenges');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await disconnect();
  process.exit(0);
});