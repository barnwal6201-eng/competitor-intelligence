// Phase 9: standalone scan worker entry point.
// Run with `npm run worker`. Connects to MongoDB and Redis, starts the
// scan worker, and (re)creates the repeatable scheduled jobs. Use this
// in production instead of the in-process worker (set
// SCAN_WORKER_IN_PROCESS=false on the API server so scans are not
// processed twice). Shuts down cleanly on SIGTERM / SIGINT.
import { connectDb } from "./config/db";
import { checkRedis } from "./config/redis";
import { startScanWorker, closeScanWorker } from "./workers/scanWorker";
import { resyncSchedules, closeScanQueue } from "./queues/scanQueue";

async function start() {
  const db = await connectDb();
  console.log(`Database: ${db.connected ? "connected" : "disconnected"} — ${db.note}`);
  if (!db.connected) {
    console.error("Worker needs MongoDB — set MONGODB_URI in backend/.env");
    process.exit(1);
  }
  const redis = await checkRedis();
  console.log(`Redis: ${redis.connected ? "connected" : "disconnected"} — ${redis.note}`);
  if (!redis.connected) {
    console.error("Worker needs Redis — set REDIS_URL in backend/.env and start redis-server");
    process.exit(1);
  }
  startScanWorker();
  const resync = await resyncSchedules();
  console.log(
    `[scan-worker] schedules resynced: ${resync.scheduled} scheduled, ${resync.skipped} paused/skipped, ${resync.errors} errors`
  );
  console.log("Scan worker running — press Ctrl+C to stop");
}

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`\nReceived ${signal} — shutting down scan worker…`);
  await closeScanWorker();
  await closeScanQueue();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((err) => {
  console.error("Failed to start scan worker:", err);
  process.exit(1);
});
