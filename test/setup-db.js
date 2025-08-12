import 'dotenv/config';
import mongoose from 'mongoose';

beforeAll(async () => {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('MONGODB_URI (or DATABASE_URL) environment variable not set for tests');
  }
  // Safety: prevent tests from ever connecting to a non-test database
  const dbNameMatch = uri.match(/\/([^\/?]+)(?:\?|$)/);
  const databaseName = dbNameMatch ? dbNameMatch[1] : '';
  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against non-test database name: "${databaseName}". ` +
      'Set MONGODB_URI to a test database (e.g., mongodb://mongo:27017/dailyfuel-test).'
    );
  }
  await mongoose.connect(uri, {
    // modern Mongoose no longer needs useNewUrlParser/useUnifiedTopology
    autoIndex: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});


