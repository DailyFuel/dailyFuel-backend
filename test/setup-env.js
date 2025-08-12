process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://unused:27017/ignore';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.PORT = process.env.PORT || '0';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123';
process.env.SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED || 'false';

// Make Mongoose operations fail fast instead of buffering when no DB connection is present
import mongoose from 'mongoose';
mongoose.set('bufferCommands', false);


