import mongoose from "mongoose";
import config from "./config.js";

export async function connect() {
    if (!config.MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured");
    }
    // Safety: In test environment, forbid connections to non-local MongoDB hosts
    if (process.env.NODE_ENV === 'test' && process.env.TEST_DB_ALLOW_NONLOCAL !== 'true') {
        try {
            const parsed = new URL(config.MONGODB_URI);
            const hostname = parsed.hostname?.toLowerCase();
            const databaseName = (parsed.pathname || '').replace(/^\//, '');
            const allowedHosts = new Set(['mongo', 'localhost', '127.0.0.1']);
            if (!allowedHosts.has(hostname)) {
                throw new Error(`Test DB host must be local (got "${hostname}")`);
            }
            if (!/test/i.test(databaseName)) {
                throw new Error(`Test DB name must include "test" (got "${databaseName}")`);
            }
        } catch (parseError) {
            // If URL parsing fails, fail closed in test env
            throw new Error(`Invalid or unsafe MONGODB_URI for tests: ${parseError.message}`);
        }
    }
    await mongoose.connect(config.MONGODB_URI)
    console.log(mongoose.connection.readyState == 1 ? "Connected to MongoDB" : "Failed to connect to MongoDB")
}

export async function disconnect() {
    await mongoose.connection.close()
    console.log(mongoose.connection.readyState == 0 ? "Disconnected from MongoDB" : "Failed to disconnect from MongoDB")
}

export default { connect, disconnect }