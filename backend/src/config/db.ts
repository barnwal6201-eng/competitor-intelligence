import mongoose from "mongoose";
import { env } from "./env";

// Phase 1 rule: a missing or unreachable database must NOT kill the server.
// The health endpoint reports the real status, so the frontend-backend link
// can be verified before MongoDB Atlas is set up.
export async function connectDb(): Promise<{ connected: boolean; note: string }> {
  if (!env.mongodbUri) {
    return { connected: false, note: "MONGODB_URI is not set (see backend/.env.example)" };
  }
  try {
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
    return { connected: true, note: "Connected to MongoDB" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("MongoDB connection failed (server keeps running):", message);
    return { connected: false, note: `Connection failed: ${message}` };
  }
}

export function getDbStatus(): { connected: boolean; note: string } {
  if (mongoose.connection.readyState === 1) {
    return { connected: true, note: "Connected to MongoDB" };
  }
  if (!env.mongodbUri) {
    return { connected: false, note: "MONGODB_URI is not set (see backend/.env.example)" };
  }
  return { connected: false, note: "Not connected to MongoDB" };
}
