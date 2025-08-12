import 'dotenv/config';
import mongoose from 'mongoose';

async function run() {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('Missing MONGODB_URI/DATABASE_URL');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const res = await mongoose.connection.db.collection('users').updateMany({}, { $unset: { subscriptionStatus: 1 } });
  console.log('Unset subscriptionStatus on users:', res.modifiedCount);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

