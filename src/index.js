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
import notification_routes from '../routes/notification_routes.js'
import analytics_routes from '../routes/analytics_routes.js'

const app = express();
const port = process.env.PORT;

// Security middleware

app.use(cors());
app.use(helmet())


app.use(express.json())
app.use(cookieParser())
// Routes
app.use(user_routes)
app.use(habit_routes)
app.use(habit_log_routes)
app.use(streak_routes)
app.use(affiliate_routes)
app.use(referral_routes)
app.use(subscription_routes)
app.use(social_routes)
app.use(achievement_routes)
app.use(notification_routes)
app.use(analytics_routes)


// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
})

app.listen(port, async () => {
    console.log(`App listening on port ${port}`)
    connect()
})