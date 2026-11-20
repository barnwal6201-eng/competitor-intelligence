import type { Response } from "express";
import mongoose from "mongoose";
import { ScanJob } from "../models/ScanJob";
import { getQueueCounts } from "../queues/scanQueue";
import { checkRedis } from "../config/redis";
import type { AuthRequest } from "../middleware/auth";

function dbConnected(res: Response): boolean {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "Database not connected — set MONGODB_URI in backend/.env and restart the backend",
    });
    return false;
  }
  return true;
}

function orgFilter(req: AuthRequest) {
  return { organizationId: new mongoose.Types.ObjectId(req.user!.organizationId) };
}

function publicScanJob(j: any) {
  return {
    id: String(j._id),
    organizationId: String(j.organizationId),
    competitorId: String(j.competitorId),
    jobId: j.bullmqJobId,
    trigger: j.trigger,
    status: j.status,
    resultSummary: j.resultSummary ?? null,
    errorMessage: j.errorMessage ?? null,
    attemptsMade: j.attemptsMade ?? null,
    queuedAt: j.queuedAt ? new Date(j.queuedAt).toISOString() : null,
    startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : null,
    finishedAt: j.finishedAt ? new Date(j.finishedAt).toISOString() : null,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

// GET /api/jobs/:jobId — one scan job, by its MongoDB record id or its
// BullMQ job id. Org-scoped: another organization's job answers 404.
export async function getScanJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const jobId = req.params.jobId as string;
    const filter: Record<string, unknown> = orgFilter(req);
    if (mongoose.isValidObjectId(jobId)) {
      filter._id = jobId;
    } else {
      filter.bullmqJobId = jobId;
    }
    const job = await ScanJob.findOne(filter).lean();
    if (!job) {
      res.status(404).json({ error: "Scan job not found" });
      return;
    }
    res.json({ scanJob: publicScanJob(job) });
  } catch (err) {
    console.error("Get scan job failed:", err);
    res.status(500).json({ error: "Failed to load scan job" });
  }
}

// GET /api/jobs — recent scan jobs for the organization, newest first.
// Optional ?competitorId= and ?limit= (default 20, max 100). Also
// returns the live queue counts and Redis status, so the frontend can
// show whether background scans are actually running.
export async function listScanJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const filter: Record<string, unknown> = orgFilter(req);
    const competitorId = typeof req.query.competitorId === "string" ? req.query.competitorId : "";
    if (competitorId && mongoose.isValidObjectId(competitorId)) {
      filter.competitorId = new mongoose.Types.ObjectId(competitorId);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const jobs = await ScanJob.find(filter).sort({ queuedAt: -1 }).limit(limit).lean();
    const redis = await checkRedis();
    const counts = redis.connected ? await getQueueCounts() : null;
    res.json({
      scanJobs: jobs.map(publicScanJob),
      redis: { connected: redis.connected, note: redis.note },
      queueCounts: counts,
    });
  } catch (err) {
    console.error("List scan jobs failed:", err);
    res.status(500).json({ error: "Failed to list scan jobs" });
  }
}
