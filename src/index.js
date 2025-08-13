import config, { isDev } from './config.js'
if (isDev) {
  console.log('=== BACKEND STARTING ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Process ID:', process.pid);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import rateLimit from 'express-rate-limit'

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
// config imported above

const app = express();
// When behind a reverse proxy/load balancer, trust the proxy to correctly mark TLS and IP
if (!isDev) {
  app.set('trust proxy', 1);
}
const port = config.PORT;

// Per-route limiter for webhooks (allow Stripe bursts but protect abuse)
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 600 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests' },
});

// Webhooks must be mounted BEFORE any body parsers
app.use('/webhooks', webhookLimiter, webhook_routes)

// Security middleware
// CORS allowlist using config.CORS_ORIGINS (comma-separated). Enable credentials for cookie-based auth.
const allowedOrigins = (config.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (isDev && !allowedOrigins.includes('http://localhost:4321')) {
  allowedOrigins.push('http://localhost:4321');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser or same-origin requests without an Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  // No cookies for auth with header-only strategy; do not expose Set-Cookie
  exposedHeaders: [],
}));
// Hardened security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Basic self-only policy; expand as needed for CDN/assets
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' },
  // Enable HSTS in production only
  hsts: isDev ? false : { maxAge: 15552000, includeSubDomains: true, preload: true },
}))

// Global rate limiter (conservative defaults)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Structured logging (skip in test)
if (process.env.NODE_ENV !== 'test') {
  const logger = pinoHttp({
    level: isDev ? 'debug' : 'info',
    redact: {
      // Use bracket notation for hyphenated header keys
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      remove: true,
    },
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          id: req.id,
          remoteAddress: req.socket?.remoteAddress,
          remotePort: req.socket?.remotePort,
        };
      },
    },
  });
  app.use(logger);
}

app.use(express.json())
app.use(cookieParser())

// Debug: Log route imports
if (isDev) {
  console.log('Friend routes imported:', !!friend_routes);
  console.log('Leaderboard routes imported:', !!leaderboard_routes);
  console.log('Community challenge routes imported:', !!community_challenge_routes);
}

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
// Billing endpoints limiter (stricter than global)
const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 120 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many billing requests, please try again later.' },
});
app.use('/billing', billingLimiter, billing_routes)
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

// Health and readiness endpoints
app.get('/healthz', async (_req, res) => {
  const state = ['disconnected', 'connected', 'connecting', 'disconnecting'][
    (await import('mongoose')).default.connection.readyState
  ] || 'unknown';
  res.json({ status: 'ok', db: state });
});

app.get('/readyz', async (_req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const ready = mongoose.connection.readyState === 1; // connected
    res.status(ready ? 200 : 503).json({ ready, db: ready ? 'connected' : 'not_connected' });
  } catch (e) {
    res.status(503).json({ ready: false, error: 'db_check_failed' });
  }
});

// Test routes only in development
if (isDev) {
  app.get('/test-friends', (_req, res) => {
    res.json({ message: 'Test friends route works' });
  });

  app.get('/test-friends/challenges', (_req, res) => {
    res.json({ message: 'Test friends challenges route works' });
  });

  app.get('/test', (_req, res) => {
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
}

// Debug endpoint to test authentication (development only)
if (isDev) {
  app.get('/debug/auth', (req, res) => {
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', Boolean(authHeader));
    if (!authHeader) {
      return res.json({ 
        error: 'No authorization header',
        headers: Object.keys(req.headers)
      });
    }
    res.json({ 
      message: 'Auth header received',
      hasAuthHeader: true,
      headers: Object.keys(req.headers)
    });
  });
}

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
  if (isDev) console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.url
  });
});

// Start server
let server;
const startServer = async () => {
  try {
    await connect();
    // Start background schedulers only after DB is connected and when enabled
    if (String(config.SCHEDULER_ENABLED) === 'true') {
      startReminderScheduler();
    } else if (isDev) {
      console.log('Reminder scheduler is disabled (SCHEDULER_ENABLED != "true").');
    }
    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      if (isDev) {
        console.log('Available routes:');
        console.log('- GET /ping');
        console.log('- GET /test');
        console.log('- GET /debug/auth');
        console.log('- GET /test-friends');
        console.log('- GET /test-friends/challenges');
      }
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
  if (server) await new Promise(r => server.close(r));
  await disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (server) await new Promise(r => server.close(r));
  await disconnect();
  process.exit(0);
});