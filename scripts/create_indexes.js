// Ensure MongoDB indexes are created for hot paths
import mongoose from 'mongoose';
import config from '../src/config.js';

import '../models/user.js';
import '../models/habit.js';
import '../models/habit_log.js';
import '../models/streak.js';
import '../models/social_share.js';
import '../models/reminder.js';
import '../models/analytics.js';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected. Creating indexes...');

    // Mongoose createIndexes is triggered by ensureIndexes on each model when initialized
    // But we can also force sync using Model.syncIndexes() for explicitness
    const models = Object.values(mongoose.models);
    for (const model of models) {
      console.log(`Syncing indexes for ${model.modelName}...`);
      await model.syncIndexes();
    }

    console.log('All indexes synced successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create indexes:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main();

