import type { Response } from "express";
import mongoose from "mongoose";
import { Competitor } from "../models/Competitor";
import { Snapshot, type SnapshotSourceType } from "../models/Snapshot";
import { runScanForCompetitor } from "../scrapers";
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

// POST /api/competitors/:id/scan — scrape the competitor's pages now and
// store a snapshot per source. A manual trigger is allowed even when
// monitoring is paused: pausing stops automatic scans (Phase 9), not an
// explicit scan the user just asked for.
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
    const summary = await runScanForCompetitor(competitor);
    res.json({ scan: summary });
  } catch (err) {
    console.error("Scan failed:", err);
    res.status(500).json({ error: "Scan failed" });
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
