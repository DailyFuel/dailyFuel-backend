import mongoose from "mongoose";
import 'dotenv/config'

export async function connect() {
    await mongoose.connect(process.env.DATABASE_URL)
    console.log("Successfully connected to MongoDB")
}

export async function disconnect() {
    await mongoose.connection.close()
    console.log("Successfully disconnected from MongoDB")
}