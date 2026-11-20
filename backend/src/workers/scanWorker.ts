// Phase 9: the scan worker.
//
// The worker is the only place that runs a scan. The API server never
// scrapes a page directly in Phase 9 — it enqueues, the worker picks
// the job up, loads the competitor fresh from MongoDB (org-scoped, so
// a job for a deleted competitor fails cleanly), calls the Phase 4
// scanner (runScanForCompetitor, which also does Phase 5 change
// detection), then records the outcome in two places:
//   1. the durable ScanJob record (queued -> active -> completed/failed,
//      with the scan summary or the error), and
//   2. the Competitor's lastScannedAt / lastScanStatus, for the
//      dashboard's scan-health table.
// A scan that fails after 3 attempts (BullMQ retries with exponential
// backoff) is marked failed with its error — never silently dropped.
//
// The worker can run two ways:
//   - in-process: server.ts starts it when SCAN_WORKER_IN_PROCESS
//     is not "false" (development default — one `npm run dev` is enough)
//   - standalone: `npm run worker` runs src/worker.ts (production —
//     the API and the worker scale independently).
import { Worker, type Job } from "bullmq";
import mongoose from "mongoose";
import { createRedisConnection } from "../config/redis";
import { env } from "../config/env";
import { Competitor } from "../models/Competitor";
import { ScanJob } from "../models/ScanJob";
import { runScanForCompetitor } from "../scrapers";
import { SCAN_QUEUE_NAME, type ScanJobData } from "../queues/scanQueue";

let worker: Worker<ScanJobData> | null = null;

function scanOutcome(summary: Awaited<ReturnType<typeof runScanForCompetitor>>): "success" | "partial" | "failed" {
  if (summary.results.length === 0) return "failed";
  const failed = summary.results.filter((r) => r.outcome === "failed" || r.outcome === "blocked").length;
  if (failed === 0) return "success";
  if (failed < summary.results.length) return "partial";
  return "failed";
}

async function processScanJob(job: Job<ScanJobData>): Promise<{ scannedAt: string; results: unknown[] }> {
  const { competitorId, organizationId, trigger } = job.data;
  // The durable ScanJob record. Manual jobs already have one (created
  // by enqueueScan); scheduled jobs do NOT — repeatable jobs bypass
  // enqueueScan — so create one here. Its bullmqJobId is
  // `<job.id>:<job.timestamp>`: repeatable firings reuse the same job
  // id, but each firing has its own timestamp, so every run gets its
  // own record and the scan-jobs list shows scheduled runs too.
  let record = await ScanJob.findOne({ bullmqJobId: String(job.id) });
  if (!record) {
    record = await ScanJob.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      competitorId: new mongoose.Types.ObjectId(competitorId),
      bullmqJobId: `${job.id}:${job.timestamp}`,
      trigger,
      status: "active",
      attemptsMade: job.attemptsMade + 1,
      queuedAt: new Date(job.timestamp),
      startedAt: new Date(),
    });
  } else {
    record.status = "active";
    record.startedAt = new Date();
    record.attemptsMade = job.attemptsMade + 1;
    await record.save();
  }
  await job.updateProgress(10);

  const competitor = await Competitor.findOne({
    _id: competitorId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
  });
  if (!competitor) {
    const message = "Competitor not found (deleted or moved to another organization)";
    if (record) {
      record.status = "failed";
      record.errorMessage = message;
      record.finishedAt = new Date();
      await record.save();
    }
    throw new Error(message);
  }

  try {
    const summary = await runScanForCompetitor(competitor);
    await job.updateProgress(100);
    const outcome = scanOutcome(summary);
    if (record) {
      record.status = "completed";
      record.resultSummary = {
        scannedAt: summary.scannedAt,
        results: summary.results.map((r) => ({
          sourceType: r.sourceType,
          outcome: r.outcome,
          changesDetected: r.changesDetected,
          message: r.message,
        })),
      };
      record.finishedAt = new Date();
      await record.save();
    }
    await Competitor.updateOne(
      { _id: competitor._id },
      { $set: { lastScannedAt: new Date(summary.scannedAt), lastScanStatus: outcome } }
    );
    console.log(
      `[scan-worker] ${trigger} scan completed for ${competitor.companyName}: ` +
        summary.results.map((r) => `${r.sourceType}=${r.outcome}`).join(", ")
    );
    return { scannedAt: summary.scannedAt, results: summary.results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    if (record) {
      record.status = "failed";
      record.errorMessage = message.slice(0, 500);
      record.finishedAt = new Date();
      await record.save();
    }
    await Competitor.updateOne(
      { _id: competitor._id },
      { $set: { lastScannedAt: new Date(), lastScanStatus: "failed" } }
    );
    throw err;
  }
}

export function startScanWorker(): Worker<ScanJobData> | null {
  if (worker) return worker;
  worker = new Worker<ScanJobData>(SCAN_QUEUE_NAME, processScanJob, {
    connection: createRedisConnection(),
    concurrency: env.scanWorkerConcurrency,
  });
  worker.on("failed", (job, err) => {
    console.error(`[scan-worker] job ${job?.id} failed:`, err instanceof Error ? err.message : err);
  });
  worker.on("error", (err) => {
    console.error("[scan-worker] worker error:", err);
  });
  console.log(`[scan-worker] started (concurrency ${env.scanWorkerConcurrency})`);
  return worker;
}

export async function closeScanWorker(): Promise<void> {
  if (!worker) return;
  const w = worker;
  worker = null;
  try {
    await w.close();
  } catch {
    // already closed
  }
}
