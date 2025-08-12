# Daily Fuel Backend

A comprehensive habit tracking API built for Gen Z and Millennials who love sharing their progress on social media.

## 🚀 Phase 1 Features (MVP Launch)

### 1. Social Sharing Endpoints - Critical for Viral Growth

**Share Streaks:**
```http
POST /social/streak/:streakId
{
  "platform": "tiktok",
  "customMessage": "🔥 30-day workout streak!"
}
```

**Share Achievements:**
```http
POST /social/achievement/:achievementId
{
  "platform": "instagram",
  "customMessage": "Just unlocked my first achievement!"
}
```

**Share Progress:**
```http
POST /social/progress
{
  "platform": "twitter",
  "timeRange": "week"
}
```

### 2. Push Notifications - Essential for Habit Retention

**Get Notifications:**
```http
GET /notifications?unreadOnly=true&limit=10
```

**Mark as Read:**
```http
PUT /notifications/:notificationId/read
```

**Notification Types:**
- `habit_reminder` - Daily habit reminders
- `streak_milestone` - Streak milestone reached
- `achievement_unlocked` - New achievement unlocked
- `streak_break` - Streak about to break
- `motivation` - Daily motivational messages

### 3. Basic Analytics - Progress Charts & Insights

**Weekly Analytics:**
```http
GET /analytics/weekly
```

**Monthly Analytics:**
```http
GET /analytics/monthly
```

**Progress Insights:**
```http
GET /analytics/insights
```

**Habit Correlations:**
```http
GET /analytics/correlations
```

### 4. Achievement System - Gamification for Engagement

**Get Achievements:**
```http
GET /achievements
```

**Achievement Types:**
- `streak_milestone` - 7, 30, 100 day streaks
- `habit_master` - Completed 10, 50, 100 habits
- `early_bird` - Logged habits before 8 AM
- `night_owl` - Logged habits after 10 PM
- `weekend_warrior` - Logged on weekends
- `social_butterfly` - Shared 5, 10, 20 times

## 📊 API Endpoints

### Authentication
- `POST /register` - Create new account
- `POST /login` - User login
- `GET /user` - Get user profile (admin)

### Habits
- `POST /habits` - Create new habit
- `GET /habits` - Get user's habits
- `GET /habits/:id` - Get specific habit
- `PUT /habits/:id` - Update habit
- `DELETE /habits/:id` - Delete habit

### Habit Logging
- `POST /habit-logs` - Log a habit
- `GET /habit-logs/habit/:habitId` - Get logs for habit
- `GET /habit-logs/today` - Get today's logs
- `DELETE /habit-logs/:id` - Delete log

### Streaks
- `GET /streaks/:habitId` - Get all streaks for habit
- `GET /streaks/current/:habitId` - Get current streak
- `GET /streaks/stats/:habitId` - Get streak statistics

### Social Sharing
- `POST /social/streak/:streakId` - Share streak
- `POST /social/achievement/:achievementId` - Share achievement
- `POST /social/progress` - Share progress summary
- `GET /social/history` - Get sharing history
- `GET /social/stats` - Get sharing statistics

### Achievements
- `GET /achievements` - Get all achievements
- `GET /achievements/stats` - Get achievement statistics
- `GET /achievements/recent` - Get recent achievements
- `GET /achievements/type/:type` - Get achievements by type

### Notifications
- `GET /notifications` - Get user notifications
- `GET /notifications/unread-count` - Get unread count
- `PUT /notifications/:id/read` - Mark as read
- `PUT /notifications/read-all` - Mark all as read

### Analytics
- `GET /analytics/weekly` - Weekly analytics
- `GET /analytics/monthly` - Monthly analytics
- `GET /analytics/insights` - Progress insights
- `GET /analytics/correlations` - Habit correlations
- `GET /analytics/summary` - Complete analytics summary

### Monetization
- `GET /affiliate` - Get affiliate info
- `POST /affiliate/register` - Register as affiliate
- `GET /subscription` - Get subscription status
- `POST /subscription/start` - Start subscription
- `POST /subscription/cancel` - Cancel subscription
 - `POST /subscription/start-trial` - Start a trial for the authenticated user (default 7 days)
 - `POST /subscription/extend-trial` - Extend an active trial (default 7 days)

## 🛠️ Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Environment variables:**
Create a `.env` file (see `.env.example`) with at least these keys:
```bash
MONGODB_URI=mongodb://localhost:27017/dailyfuel
JWT_SECRET=your-secret-key
PORT=3033
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional (recommended)
ADMIN_EMAILS=admin@example.com,another@admin.com
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_RESTORE_STREAK=price_...
CORS_ORIGINS=http://localhost:4321
BILLING_SUCCESS_URL=http://localhost:4321/dashboard?purchase=success
BILLING_CANCEL_URL=http://localhost:4321/pricing?purchase=cancelled
SCHEDULER_ENABLED=true
```

### Setup checklist

- Copy `.env.example` to `.env` and fill values:
  - `MONGODB_URI`, `JWT_SECRET`, `PORT`
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs
  - Admin: `ADMIN_EMAILS`
  - CORS: `CORS_ORIGINS` (comma-separated, e.g. `http://localhost:4321`)
  - Billing URLs: `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL`
  - Scheduler: `SCHEDULER_ENABLED` (enable on only one instance)
- Install deps: `npm install`
- Create indexes: `npm run db:indexes`
- Start server: `npm run dev`
- Verify health: `GET /healthz` (200) and readiness `GET /readyz` (200 when DB connected)
- Confirm CORS by loading the frontend from allowed origins

### Docker Compose (local dev)

## 🏭 Production

### Required environment variables

Set these securely in your hosting environment:

- `NODE_ENV=production`
- `PORT=3033`
- `MONGODB_URI` (e.g., `mongodb://mongo:27017/dailyfuel`)
- `JWT_SECRET` (strong random string)
- `CORS_ORIGINS` (comma‑separated, e.g., `https://<YOUR_DOMAIN>`)
- Stripe billing (if enabled):
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `STRIPE_PRICE_PRO_YEARLY`
- `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL`
- Scheduler flag: `SCHEDULER_ENABLED` ("true" only on one instance)

### Deployment with Docker Compose

From repository root for the full stack (frontend + backend + scheduler + mongo + nginx):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Backend‑only (under `dailyFuel-backend/`):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Frontend‑only (under `dailyFuel-frontend/`):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Database readiness and indexes

Create required indexes after first deploy and whenever indexes change:

```bash
npm run db:indexes
```

Health endpoints:
- Liveness: `GET /healthz`
- Readiness: `GET /readyz`

### Auth strategy

This deployment uses header‑only auth: clients send `Authorization: Bearer <token>` and no auth cookies are set.

You can run MongoDB and the backend (plus optional Stripe CLI) via docker compose from the repository root:

```bash
docker compose up -d mongo backend
# optionally include stripe webhook forwarding
docker compose --profile stripe up -d stripe
```

The backend will be available at `http://localhost:3033` and connect to the `mongo` service. To stop:

```bash
docker compose down
```

### Background scheduler

Set `SCHEDULER_ENABLED=true` only on a single instance (or use an external scheduler).
The server will start the reminder scheduler only when this flag is exactly `"true"`.
This avoids duplicate scheduled jobs when running multiple instances.

3. **Run the server:**
```bash
npm run dev
```

4. **Seed the database:**
```bash
npm run seed
```

## 🎯 Target Audience Features

### For TikTokers & Creators:
- Social sharing with custom messages
- Viral streak sharing
- Achievement sharing
- Progress tracking for content

### For Gym-goers:
- Workout habit tracking
- Streak milestones
- Progress analytics
- Motivational notifications

### For Productivity Lovers:
- Detailed analytics
- Habit correlations
- Progress insights
- Goal tracking

### For ADHD Folk:
- Simple habit logging
- Visual streak tracking
- Achievement gamification
- Reminder notifications

### For Sobriety Warriors:
- Daily check-ins
- Streak milestones
- Community support features
- Motivational content

## 🚀 Next Steps (Phase 2)

- Community challenges
- Friend system
- Public profiles
- Advanced analytics
- Creator tools
- AI-powered insights

## 📈 Revenue Model

- **Freemium:** Basic features free, premium analytics paid
- **Affiliate Program:** Creators earn from referrals
- **Premium Features:** Advanced analytics, unlimited habits
- **Creator Tools:** Enhanced sharing and analytics

---

**"Everyday, done better."** - The cool, simple, shareable alternative to the big guys.

## Trial fields in subscription status

When a trial is active, `GET /subscription` now returns:

```json
{
  "plan": "free",
  "status": "active",
  "trial": { "active": true, "startedAt": "2025-01-01T00:00:00.000Z", "endsAt": "2025-01-08T00:00:00.000Z" },
  "limits": { /* ... */ }
}
```