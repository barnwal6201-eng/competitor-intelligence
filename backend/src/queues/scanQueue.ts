// Phase 9: the BullMQ scan queue.
//
// One queue, "scan-queue", two job kinds:
//   - "scan-competitor": scan one competitor now. Data carries the
//     competitorId + organizationId + trigger ("manual" | "scheduled").
//     The worker loads the competitor fresh from MongoDB (org-scoped),
//     so a stale job for a deleted / moved competitor answers 404 in
//     the worker and fails cleanly instead of scanning the wrong thing.
//   - Repeatable "scan-competitor" jobs: one per monitored competitor,
//     repeating every hour / day / week from monitoringFrequency.
//     Only competitors with isMonitoringEnabled=true get one; pausing,
//     deleting, or changing frequency removes / re-creates it.
//
// Safety rules (PRD: no duplicate scans, no lost jobs, no silent fail):
//   - Manual scans are de-duplicated: if a queued/active job for the
//     same competitor already exists, enqueueScan returns it instead
//     of adding a second one.
//   - Jobs retry 3 times with exponential backoff; a failed job stays
//     visible in the ScanJob record with its error, it is not deleted.
//   - If Redis is down, enqueueScan returns { queued: false } and the
//     caller (scanController) runs the scan synchronously instead —
//     Phase 4 behaviour — so the app never hard-fails for lack of Redis.
import { Queue, type Job } from "bullmq";
import mongoose from "mongoose";
import { createRedisConnection, getRedisStatus } from "../config/redis";
import { Competitor, type MonitoringFrequency } from "../models/Competitor";
import { ScanJob } from "../models/ScanJob";

export const SCAN_QUEUE_NAME = "scan-queue";

export interface ScanJobData {
  competitorId: string;
  organizationId: string;
  trigger: "manual" | "scheduled";
}

export interface EnqueueResult {
  queued: boolean;
  jobId: string;
  scanJobId?: string;
  status: "queued" | "active";
  reason?: string;
}

let queue: Queue<ScanJobData> | null = null;

// BullMQ's ioredis connections retry forever (maxRetriesPerRequest:
// null), so a queue call against a dead Redis would hang the request
// forever instead of failing. Every queue call below is wrapped in
// this timeout so the caller can fall back (synchronous scan, or a
// best-effort skip) instead of hanging.
const QUEUE_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${QUEUE_TIMEOUT_MS}ms (Redis unreachable?)`)), QUEUE_TIMEOUT_MS);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function getScanQueue(): Queue<ScanJobData> | null {
  if (queue) return queue;
  if (getRedisStatus().connected === false && queue === null) {
    // Lazily create the queue anyway — BullMQ will keep retrying its
    // Redis connection in the background, and the first enqueue will
    // surface the real error to the caller. Creating it does not throw.
  }
  queue = new Queue<ScanJobData>(SCAN_QUEUE_NAME, { connection: createRedisConnection() });
  return queue;
}

export function frequencyToMs(frequency: MonitoringFrequency): number {
  if (frequency === "hourly") return 60 * 60 * 1000;
  if (frequency === "weekly") return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000; // daily
}

function manualJobId(competitorId: string): string {
  // Unique per scan: a manual jobId is never reused. Reusing one would
  // make BullMQ hand back the old (already completed) job instead of
  // running a new scan, and the new ScanJob record would stay "queued"
  // forever. Dedupe is done by findLiveJob() below, not by jobId.
  // No colons: BullMQ rejects a custom jobId containing ":" unless it
  // splits into exactly 3 parts.
  return `scan-manual-${competitorId}-${Date.now()}`;
}

function scheduledJobId(competitorId: string): string {
  return `scan-scheduled-${competitorId}`;
}

async function findLiveJob(competitorId: string): Promise<Job<ScanJobData> | null> {
  const q = getScanQueue();
  if (!q) return null;
  try {
    // A live job for this competitor: waiting, delayed, active, or
    // prioritized, with matching competitorId in its data. Repeatable
    // (scheduled) jobs are excluded — they are the schedule, not a run.
    const jobs = await withTimeout(
      q.getJobs(["waiting", "delayed", "active", "prioritized"], 0, 100),
      "Checking for a live scan job"
    );
    for (const job of jobs) {
      if (job.data?.competitorId === competitorId && job.data?.trigger === "manual") return job;
    }
    return null;
  } catch {
    return null;
  }
}

// Enqueue a manual scan. Returns the live job if one is already queued /
// active for this competitor (dedupe), otherwise adds a new one and
// creates its durable ScanJob record first.
export async function enqueueScan(
  competitorId: string,
  organizationId: string,
  trigger: "manual" | "scheduled" = "manual"
): Promise<EnqueueResult> {
  const jobId = trigger === "scheduled" ? scheduledJobId(competitorId) : manualJobId(competitorId);
  const q = getScanQueue();
  if (!q) return { queued: false, jobId, status: "queued", reason: "Queue unavailable" };
  try {
    const existing = await findLiveJob(competitorId);
    if (existing) {
      const record = (await ScanJob.findOne({ bullmqJobId: String(existing.id) }).lean()) as unknown as {
        _id: unknown;
      } | null;
      return {
        queued: true,
        jobId: String(existing.id),
        scanJobId: record ? String(record._id) : undefined,
        status: "active",
        reason: "A scan for this competitor is already queued or running",
      };
    }
    const job = await withTimeout(
      q.add(
        "scan-competitor",
        { competitorId, organizationId, trigger },
        {
          jobId,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      ),
      "Enqueueing scan job"
    );
    const record = await ScanJob.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      competitorId: new mongoose.Types.ObjectId(competitorId),
      bullmqJobId: String(job.id),
      trigger,
      status: "queued",
      queuedAt: new Date(),
    });
    return { queued: true, jobId: String(job.id), scanJobId: String(record._id), status: "queued" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { queued: false, jobId, status: "queued", reason: `Could not enqueue scan: ${message}` };
  }
}

// (Re)create the repeatable job for one competitor. No-op when monitoring
// is paused; removes the repeatable job when it is.
export async function scheduleCompetitor(
  competitor: { _id: unknown; organizationId: unknown; monitoringFrequency: MonitoringFrequency; isMonitoringEnabled: boolean }
): Promise<{ scheduled: boolean; reason?: string }> {
  const competitorId = String(competitor._id);
  const q = getScanQueue();
  if (!q) return { scheduled: false, reason: "Queue unavailable" };
  try {
    if (!competitor.isMonitoringEnabled) {
      await unscheduleCompetitor(competitorId);
      return { scheduled: false, reason: "Monitoring paused" };
    }
    // Remove any old repeatable job first (e.g. the frequency changed
    // from daily to hourly) so two schedules can never run for one
    // competitor.
    await unscheduleCompetitor(competitorId);
    await withTimeout(
      q.add(
        "scan-competitor",
        {
          competitorId,
          organizationId: String(competitor.organizationId),
          trigger: "scheduled",
        },
        {
          jobId: scheduledJobId(competitorId),
          repeat: { every: frequencyToMs(competitor.monitoringFrequency) },
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      ),
      "Scheduling repeatable scan job"
    );
    return { scheduled: true };
  } catch (err) {
    return { scheduled: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function unscheduleCompetitor(competitorId: string): Promise<void> {
  const q = getScanQueue();
  if (!q) return;
  for (const freq of ["hourly", "daily", "weekly"] as MonitoringFrequency[]) {
    try {
      await withTimeout(
        q.removeRepeatable("scan-competitor", { every: frequencyToMs(freq) }, scheduledJobId(competitorId)),
        "Removing repeatable scan job"
      );
    } catch {
      // already gone, or Redis unreachable — either way there is
      // nothing more to do here; resync on startup covers the rest.
    }
  }
}

// Re-create repeatable jobs for every monitored competitor (run on
// server/worker startup). Paused or deleted competitors get nothing;
// a competitor whose frequency changed gets its old repeatable job
// removed first, then the new one — so a frequency change can never
// leave two schedules running for the same competitor.
export async function resyncSchedules(): Promise<{ scheduled: number; skipped: number; errors: number }> {
  let scheduled = 0;
  let skipped = 0;
  let errors = 0;
  try {
    const competitors = (await Competitor.find({}).lean()) as unknown as {
      _id: unknown;
      organizationId: unknown;
      monitoringFrequency: MonitoringFrequency;
      isMonitoringEnabled: boolean;
    }[];
    for (const c of competitors) {
      if (!c.isMonitoringEnabled) {
        await unscheduleCompetitor(String(c._id));
        skipped++;
        continue;
      }
      const result = await scheduleCompetitor(c as never);
      if (result.scheduled) scheduled++;
      else errors++;
    }
  } catch {
    errors++;
  }
  return { scheduled, skipped, errors };
}

export async function getQueueCounts(): Promise<Record<string, number> | null> {
  const q = getScanQueue();
  if (!q) return null;
  try {
    return await withTimeout(q.getJobCounts("waiting", "active", "delayed", "completed", "failed"), "Reading queue counts");
  } catch {
    return null;
  }
}

export async function closeScanQueue(): Promise<void> {
  if (!queue) return;
  const q = queue;
  queue = null;
  try {
    await q.close();
  } catch {
    // already closed
  }
}
