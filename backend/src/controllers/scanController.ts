import type { Response } from "express";
import mongoose from "mongoose";
import { Competitor } from "../models/Competitor";
import { Snapshot, type SnapshotSourceType } from "../models/Snapshot";
import { ScanJob } from "../models/ScanJob";
import { runScanForCompetitor } from "../scrapers";
import { enqueueScan } from "../queues/scanQueue";
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

// Takes a Mongoose document or a lean object; both carry the same fields.
function publicSnapshot(s: any) {
  return {
    id: String(s._id),
    organizationId: String(s.organizationId),
    competitorId: String(s.competitorId),
    sourceType: s.sourceType,
    sourceUrl: s.sourceUrl,
    status: s.status,
    contentHash: s.contentHash,
    extractedData: s.extractedData,
    textPreview: s.textPreview,
    errorMessage: s.errorMessage,
    scrapedAt: s.scrapedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
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

// POST /api/competitors/:id/scan — Phase 9: enqueue a background scan
// instead of scraping inside the request. Returns 202 with the job id;
// the frontend polls GET /api/jobs/:jobId (or the scan-jobs list below)
// until the job is completed / failed, then reloads snapshots + changes.
//
// A manual trigger is allowed even when monitoring is paused: pausing
// stops automatic (scheduled) scans, not an explicit scan the user
// just asked for.
//
// If Redis is down, the scan runs synchronously in the request instead
// (Phase 4 behaviour) and the response is the scan summary directly,
// with `queued: false` — the endpoint never hard-fails for lack of Redis.
export async function triggerScan(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const competitor = await Competitor.findOne({ _id: id, ...orgFilter(req) });
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    // Phase 9: always try the queue first. Enqueueing is the real
    // Redis test — if it fails (Redis down, queue error), fall through
    // to a synchronous scan. A cached "Redis disconnected" flag must
    // never be the reason a scan runs synchronously while Redis is
    // actually up (a transient connection error used to flip that flag).
    const enqueued = await enqueueScan(String(competitor._id), String(competitor.organizationId), "manual");
    if (enqueued.queued) {
      res.status(202).json({
        queued: true,
        jobId: enqueued.jobId,
        scanJobId: enqueued.scanJobId ?? null,
        status: enqueued.status,
        message: enqueued.reason ?? "Scan queued — the worker will pick it up shortly",
      });
      return;
    }
    console.warn("Enqueue failed, falling back to synchronous scan:", enqueued.reason);
    const summary = await runScanForCompetitor(competitor);
    // Keep the audit trail even for the fallback path.
    await ScanJob.create({
      organizationId: competitor.organizationId,
      competitorId: competitor._id,
      bullmqJobId: `sync:${Date.now()}:${competitor._id}`,
      trigger: "manual",
      status: "completed",
      resultSummary: {
        scannedAt: summary.scannedAt,
        results: summary.results.map((r) => ({
          sourceType: r.sourceType,
          outcome: r.outcome,
          changesDetected: r.changesDetected,
          message: r.message,
        })),
      },
      queuedAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    res.json({ queued: false, scan: summary });
  } catch (err) {
    console.error("Scan failed:", err);
    res.status(500).json({ error: "Scan failed" });
  }
}

// GET /api/competitors/:id/scan-jobs — recent scan jobs for one
// competitor, newest first. Optional ?limit= (default 20, max 100).
export async function listScanJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const competitor = (await Competitor.findOne({ _id: id, ...orgFilter(req) }).lean()) as unknown as {
      _id: unknown;
    } | null;
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const jobs = await ScanJob.find({ competitorId: competitor._id, ...orgFilter(req) })
      .sort({ queuedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ scanJobs: jobs.map(publicScanJob) });
  } catch (err) {
    console.error("List scan jobs failed:", err);
    res.status(500).json({ error: "Failed to list scan jobs" });
  }
}

// GET /api/competitors/:id/snapshots — snapshot history for one competitor,
// newest first. Optional ?type=pricing|changelog|careers|reviews and
// ?limit= (default 20, max 100).
export async function listSnapshots(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    // Cast: Mongoose's .lean() typing resolves to a union with an array type
    // here; the runtime value is one document.
    const competitor = (await Competitor.findOne({ _id: id, ...orgFilter(req) }).lean()) as unknown as {
      _id: unknown;
    } | null;
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const type = typeof req.query.type === "string" ? req.query.type : "";
    const validTypes: SnapshotSourceType[] = ["pricing", "changelog", "careers", "reviews"];
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter: Record<string, unknown> = {
      competitorId: competitor._id,
      ...orgFilter(req),
    };
    if (validTypes.includes(type as SnapshotSourceType)) filter.sourceType = type;
    const snapshots = await Snapshot.find(filter).sort({ scrapedAt: -1 }).limit(limit).lean();
    res.json({ snapshots: snapshots.map(publicSnapshot) });
  } catch (err) {
    console.error("List snapshots failed:", err);
    res.status(500).json({ error: "Failed to list snapshots" });
  }
}
