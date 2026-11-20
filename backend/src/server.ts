import app from "./app";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { checkRedis } from "./config/redis";
import { startScanWorker } from "./workers/scanWorker";
import { resyncSchedules } from "./queues/scanQueue";

async function start() {
  const db = await connectDb();
  console.log(`Database: ${db.connected ? "connected" : "disconnected"} — ${db.note}`);

  const redis = await checkRedis();
  console.log(`Redis: ${redis.connected ? "connected" : "disconnected"} — ${redis.note}`);
  if (!redis.connected) {
    console.log(
      "Redis is down — manual scans will run synchronously and scheduled scans are paused. " +
        "Start redis-server and restart the backend to enable background jobs."
    );
  } else if (env.scanWorkerInProcess) {
    // Development default: the API process also runs the worker, so one
    // `npm run dev` is enough. In production set SCAN_WORKER_IN_PROCESS=false
    // and run `npm run worker` in a separate process instead.
    startScanWorker();
    const resync = await resyncSchedules();
    console.log(
      `[scan-queue] schedules resynced: ${resync.scheduled} scheduled, ${resync.skipped} paused/skipped, ${resync.errors} errors`
    );
  } else {
    console.log("In-process scan worker disabled — run `npm run worker` in a separate terminal.");
  }

  app.listen(env.port, () => {
    console.log(`Backend running at http://localhost:${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/api/health`);
    console.log(`Accepting frontend origin: ${env.frontendUrl}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
