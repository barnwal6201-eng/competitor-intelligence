import type { Response } from "express";
import mongoose from "mongoose";
import { Competitor } from "../models/Competitor";
import { Change, type ChangeCategory, type ChangeSignificance } from "../models/Change";
import type { SnapshotSourceType } from "../models/Snapshot";
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

const VALID_TYPES: SnapshotSourceType[] = ["pricing", "changelog", "careers", "reviews"];
const VALID_SIGNIFICANCES: ChangeSignificance[] = ["high", "medium", "low"];

// Takes a Mongoose document or a lean object; both carry the same fields.
function publicChange(c: any, competitorName?: string) {
  return {
    id: String(c._id),
    organizationId: String(c.organizationId),
    competitorId: String(c.competitorId),
    competitorName,
    sourceType: c.sourceType,
    category: c.category,
    significance: c.significance,
    title: c.title,
    previousValue: c.previousValue,
    newValue: c.newValue,
    sourceUrl: c.sourceUrl,
    snapshotId: String(c.snapshotId),
    previousSnapshotId: String(c.previousSnapshotId),
    detectedAt: c.detectedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// Shared query parsing for both list endpoints.
function changeFilters(req: AuthRequest) {
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const significance = typeof req.query.significance === "string" ? req.query.significance : "";
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter: Record<string, unknown> = { ...orgFilter(req) };
  if (VALID_TYPES.includes(type as SnapshotSourceType)) filter.sourceType = type;
  if (VALID_SIGNIFICANCES.includes(significance as ChangeSignificance)) {
    filter.significance = significance;
  }
  return { filter, limit };
}

// GET /api/competitors/:id/changes — detected changes for one competitor,
// newest first. Optional ?type=pricing|changelog|careers|reviews,
// ?significance=high|medium|low, ?limit= (default 20, max 100).
export async function listCompetitorChanges(req: AuthRequest, res: Response): Promise<void> {
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
      companyName: string;
    } | null;
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const { filter, limit } = changeFilters(req);
    filter.competitorId = competitor._id;
    const changes = await Change.find(filter).sort({ detectedAt: -1 }).limit(limit).lean();
    res.json({ changes: changes.map((c) => publicChange(c, competitor.companyName)) });
  } catch (err) {
    console.error("List competitor changes failed:", err);
    res.status(500).json({ error: "Failed to list changes" });
  }
}

// GET /api/changes — the intelligence feed: detected changes across every
// competitor in the user's organization, newest first. Same optional
// ?type=, ?significance=, ?limit= (default 20, max 100). Each change
// carries its competitor's name so the feed reads without extra lookups.
export async function listFeed(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const { filter, limit } = changeFilters(req);
    const changes = await Change.find(filter).sort({ detectedAt: -1 }).limit(limit).lean();
    const competitorIds = [...new Set(changes.map((c) => String(c.competitorId)))];
    const competitors = await Competitor.find({ _id: { $in: competitorIds } })
      .select("_id companyName")
      .lean();
    const names = new Map(competitors.map((c) => [String(c._id), c.companyName]));
    res.json({
      changes: changes.map((c) => publicChange(c, names.get(String(c.competitorId)))),
    });
  } catch (err) {
    console.error("List intelligence feed failed:", err);
    res.status(500).json({ error: "Failed to list changes" });
  }
}

// Re-exported for the detector's type usage elsewhere.
export type { ChangeCategory, ChangeSignificance };
