import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Competitor } from "../models/Competitor";
import { createCompetitorSchema, updateCompetitorSchema } from "../validators/competitor";
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

function handleValidationError(err: unknown, res: Response): boolean {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || "Invalid input" });
    return true;
  }
  return false;
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

// The shape returned to the frontend — no internal fields.
// Takes a Mongoose document or a lean object; both carry the same fields.
function publicCompetitor(c: any) {
  return {
    id: String(c._id),
    organizationId: String(c.organizationId),
    companyName: c.companyName,
    websiteUrl: c.websiteUrl,
    pricingPageUrl: c.pricingPageUrl,
    changelogUrl: c.changelogUrl,
    careersPageUrl: c.careersPageUrl,
    reviewSourceUrl: c.reviewSourceUrl,
    monitoringFrequency: c.monitoringFrequency,
    isMonitoringEnabled: c.isMonitoringEnabled,
    createdBy: String(c.createdBy),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// Every query below filters by organizationId (PRD sections 2 and 17):
// a user can only ever see, change, or delete their own organization's
// competitors. A competitor from another organization is indistinguishable
// from one that does not exist — both answer 404.
function orgFilter(req: AuthRequest) {
  return { organizationId: new mongoose.Types.ObjectId(req.user!.organizationId) };
}

function validId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

export async function listCompetitors(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const monitoring = typeof req.query.monitoring === "string" ? req.query.monitoring : "";
    const filter: Record<string, unknown> = orgFilter(req);
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ companyName: regex }, { websiteUrl: regex }];
    }
    if (monitoring === "enabled" || monitoring === "paused") {
      filter.isMonitoringEnabled = monitoring === "enabled";
    }
    const competitors = await Competitor.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ competitors: competitors.map(publicCompetitor) });
  } catch (err) {
    console.error("List competitors failed:", err);
    res.status(500).json({ error: "Failed to list competitors" });
  }
}

export async function getCompetitor(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const id = req.params.id as string;
    if (!validId(id)) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const competitor = await Competitor.findOne({ _id: id, ...orgFilter(req) }).lean();
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    res.json({ competitor: publicCompetitor(competitor) });
  } catch (err) {
    console.error("Get competitor failed:", err);
    res.status(500).json({ error: "Failed to load competitor" });
  }
}

export async function createCompetitor(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const input = createCompetitorSchema.parse(req.body);
    const competitor = await Competitor.create({
      ...input,
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    });
    res.status(201).json({ competitor: publicCompetitor(competitor) });
  } catch (err) {
    if (handleValidationError(err, res)) return;
    if (isDuplicateKey(err)) {
      res.status(409).json({ error: "A competitor with this website is already being monitored" });
      return;
    }
    console.error("Create competitor failed:", err);
    res.status(500).json({ error: "Failed to create competitor" });
  }
}

export async function updateCompetitor(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const id = req.params.id as string;
    if (!validId(id)) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const input = updateCompetitorSchema.parse(req.body);
    // Keys present in the parsed input with an undefined value are optional
    // URLs the user cleared ("" normalised to undefined) — remove them with
    // $unset. Keys absent entirely are left alone. Defined values are $set.
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) unset[key] = "";
      else set[key] = value;
    }
    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    const competitor = await Competitor.findOneAndUpdate(
      { _id: id, ...orgFilter(req) },
      update,
      { new: true, runValidators: true }
    );
    if (!competitor) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    res.json({ competitor: publicCompetitor(competitor) });
  } catch (err) {
    if (handleValidationError(err, res)) return;
    if (isDuplicateKey(err)) {
      res.status(409).json({ error: "A competitor with this website is already being monitored" });
      return;
    }
    console.error("Update competitor failed:", err);
    res.status(500).json({ error: "Failed to update competitor" });
  }
}

export async function deleteCompetitor(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const id = req.params.id as string;
    if (!validId(id)) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    const deleted = await Competitor.findOneAndDelete({ _id: id, ...orgFilter(req) });
    if (!deleted) {
      res.status(404).json({ error: "Competitor not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete competitor failed:", err);
    res.status(500).json({ error: "Failed to delete competitor" });
  }
}
