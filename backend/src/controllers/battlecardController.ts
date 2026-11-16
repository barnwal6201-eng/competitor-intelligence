import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Competitor } from "../models/Competitor";
import { Snapshot } from "../models/Snapshot";
import { Change } from "../models/Change";
import { Analysis } from "../models/Analysis";
import { Battlecard, type IBattlecard } from "../models/Battlecard";
import { BattlecardVersion } from "../models/BattlecardVersion";
import { composeBattlecard } from "../battlecards/composer";
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
function publicBattlecard(b: any) {
  return {
    id: String(b._id),
    organizationId: String(b.organizationId),
    competitorId: String(b.competitorId),
    competitorName: b.competitorName,
    version: b.version,
    generatedFromAnalysisId: b.generatedFromAnalysisId ? String(b.generatedFromAnalysisId) : null,
    overview: b.overview,
    positioning: b.positioning,
    pricing: b.pricing,
    pricingSourceUrl: b.pricingSourceUrl,
    pricingSnapshotDate: b.pricingSnapshotDate ? new Date(b.pricingSnapshotDate).toISOString() : undefined,
    features: b.features,
    strengths: b.strengths,
    weaknesses: b.weaknesses,
    recentChanges: (b.recentChanges as any[]).map((c) => ({
      ...c,
      detectedAt: new Date(c.detectedAt).toISOString(),
    })),
    complaints: b.complaints,
    talkingPoints: b.talkingPoints,
    objectionHandling: b.objectionHandling,
    sources: b.sources,
    aiSections: b.aiSections,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

async function loadCompetitor(req: AuthRequest, res: Response) {
  const id = req.params.id as string;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "Competitor not found" });
    return null;
  }
  // Cast: Mongoose's .lean() typing resolves to a union with an array type
  // here; the runtime value is one document.
  const competitor = (await Competitor.findOne({ _id: id, ...orgFilter(req) }).lean()) as unknown as {
    _id: unknown;
    companyName: string;
    websiteUrl: string;
    pricingPageUrl?: string;
    changelogUrl?: string;
    careersPageUrl?: string;
    reviewSourceUrl?: string;
    createdAt: Date;
  } | null;
  if (!competitor) {
    res.status(404).json({ error: "Competitor not found" });
    return null;
  }
  return competitor;
}

async function loadBattlecard(req: AuthRequest, competitorId: unknown) {
  return Battlecard.findOne({ competitorId, ...orgFilter(req) });
}

async function saveVersion(req: AuthRequest, battlecard: IBattlecard): Promise<void> {
  const plain = battlecard.toObject();
  // The version copy stores the sections, not the bookkeeping fields.
  const { _id, organizationId, competitorId, version, createdAt, updatedAt, __v, ...content } = plain as any;
  await BattlecardVersion.create({
    organizationId: battlecard.organizationId,
    battlecardId: battlecard._id,
    competitorId: battlecard.competitorId,
    version: battlecard.version,
    content,
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
  });
}

// Reads the latest data the composer needs: newest successful snapshot per
// source type, the 10 newest changes, and the newest analysis (if any).
async function gatherInputs(req: AuthRequest, competitorId: unknown) {
  const [pricing, changelog, reviews] = await Promise.all([
    Snapshot.findOne({ competitorId, sourceType: "pricing", status: "success" }).sort({ scrapedAt: -1 }).lean(),
    Snapshot.findOne({ competitorId, sourceType: "changelog", status: "success" }).sort({ scrapedAt: -1 }).lean(),
    Snapshot.findOne({ competitorId, sourceType: "reviews", status: "success" }).sort({ scrapedAt: -1 }).lean(),
  ]);
  const recentChanges = await Change.find({ competitorId, ...orgFilter(req) })
    .sort({ detectedAt: -1 })
    .limit(10)
    .lean();
  const latestAnalysis = await Analysis.findOne({ competitorId, ...orgFilter(req) })
    .sort({ generatedAt: -1 })
    .lean();
  return { latestSnapshots: { pricing, changelog, reviews }, recentChanges, latestAnalysis };
}

// POST /api/competitors/:id/battlecard/generate — build the first version
// from the latest real data (PRD section 12). Needs at least one
// successful snapshot — a battlecard with no data behind it would be an
// empty page. Returns 409 if a battlecard already exists (use Regenerate).
export async function generateBattlecard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const existing = await loadBattlecard(req, competitor._id);
    if (existing) {
      res.status(409).json({ error: "A battlecard already exists for this competitor — use Regenerate or Edit" });
      return;
    }
    const { latestSnapshots, recentChanges, latestAnalysis } = await gatherInputs(req, competitor._id);
    if (!latestSnapshots.pricing && !latestSnapshots.changelog && !latestSnapshots.reviews) {
      res.status(400).json({ error: "Scan the competitor first — a battlecard needs real snapshot data" });
      return;
    }
    const content = composeBattlecard({
      competitor: competitor as any,
      latestSnapshots: latestSnapshots as any,
      recentChanges: recentChanges as any,
      latestAnalysis: latestAnalysis as any,
    });
    const battlecard = await Battlecard.create({
      organizationId: new mongoose.Types.ObjectId(req.user!.organizationId),
      competitorId: competitor._id,
      version: 1,
      ...content,
    });
    await saveVersion(req, battlecard);
    res.status(201).json({
      battlecard: publicBattlecard({ ...battlecard.toObject(), competitorName: competitor.companyName }),
      message: latestAnalysis
        ? undefined
        : "No AI analysis exists yet — the strengths, weaknesses, talking points, and objection handling sections are empty. Run Analyse latest changes on the competitor page, then Regenerate.",
    });
  } catch (err) {
    console.error("Generate battlecard failed:", err);
    res.status(500).json({ error: "Failed to generate battlecard" });
  }
}

// POST /api/competitors/:id/battlecard/regenerate — rebuild all sections
// from the latest data + latest analysis and bump the version. The old
// version stays readable under /versions.
export async function regenerateBattlecard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const battlecard = await loadBattlecard(req, competitor._id);
    if (!battlecard) {
      res.status(404).json({ error: "No battlecard yet — generate one first" });
      return;
    }
    const { latestSnapshots, recentChanges, latestAnalysis } = await gatherInputs(req, competitor._id);
    const content = composeBattlecard({
      competitor: competitor as any,
      latestSnapshots: latestSnapshots as any,
      recentChanges: recentChanges as any,
      latestAnalysis: latestAnalysis as any,
    });
    Object.assign(battlecard, content, {
      version: battlecard.version + 1,
      generatedFromAnalysisId: content.generatedFromAnalysisId,
    });
    await battlecard.save();
    await saveVersion(req, battlecard);
    res.json({
      battlecard: publicBattlecard({ ...battlecard.toObject(), competitorName: competitor.companyName }),
      message: latestAnalysis
        ? undefined
        : "No AI analysis exists yet — the AI sections are empty. Run Analyse latest changes on the competitor page, then Regenerate again.",
    });
  } catch (err) {
    console.error("Regenerate battlecard failed:", err);
    res.status(500).json({ error: "Failed to regenerate battlecard" });
  }
}

// Only the AI-written / human-written sections are editable. Pricing,
// features, recent changes, complaints, and sources are verified data —
// they change only via a new scan + Regenerate, never by typing.
const EditSchema = z
  .object({
    overview: z.string().min(1).max(2000).optional(),
    positioning: z.string().min(1).max(2000).optional(),
    strengths: z.array(z.string().min(1).max(500)).max(20).optional(),
    weaknesses: z.array(z.string().min(1).max(500)).max(20).optional(),
    talkingPoints: z.array(z.string().min(1).max(500)).max(20).optional(),
    objectionHandling: z.array(z.string().min(1).max(500)).max(20).optional(),
  })
  .strict();

// PUT /api/competitors/:id/battlecard — edit the editable sections. Each
// save bumps the version and freezes the previous content.
export async function updateBattlecard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const battlecard = await loadBattlecard(req, competitor._id);
    if (!battlecard) {
      res.status(404).json({ error: "No battlecard yet — generate one first" });
      return;
    }
    const parsed = EditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid battlecard edit — only overview, positioning, strengths, weaknesses, talking points, and objection handling can be edited" });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    Object.assign(battlecard, parsed.data, { version: battlecard.version + 1 });
    await battlecard.save();
    await saveVersion(req, battlecard);
    res.json({ battlecard: publicBattlecard({ ...battlecard.toObject(), competitorName: competitor.companyName }) });
  } catch (err) {
    console.error("Update battlecard failed:", err);
    res.status(500).json({ error: "Failed to update battlecard" });
  }
}

// GET /api/competitors/:id/battlecard — the current version.
export async function getBattlecard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const battlecard = await Battlecard.findOne({ competitorId: competitor._id, ...orgFilter(req) }).lean();
    if (!battlecard) {
      res.status(404).json({ error: "No battlecard yet — generate one first" });
      return;
    }
    res.json({ battlecard: publicBattlecard({ ...battlecard, competitorName: competitor.companyName }) });
  } catch (err) {
    console.error("Get battlecard failed:", err);
    res.status(500).json({ error: "Failed to get battlecard" });
  }
}

// GET /api/competitors/:id/battlecard/versions — version list (newest
// first), without full content. Optional ?limit= (default 20, max 50).
export async function listBattlecardVersions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const battlecard = await loadBattlecard(req, competitor._id);
    if (!battlecard) {
      res.status(404).json({ error: "No battlecard yet — generate one first" });
      return;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const versions = await BattlecardVersion.find({ battlecardId: battlecard._id, ...orgFilter(req) })
      .sort({ version: -1 })
      .limit(limit)
      .select("version createdAt")
      .lean();
    res.json({
      versions: versions.map((v) => ({
        version: v.version,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("List battlecard versions failed:", err);
    res.status(500).json({ error: "Failed to list battlecard versions" });
  }
}

// GET /api/competitors/:id/battlecard/versions/:version — one frozen version.
export async function getBattlecardVersion(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const battlecard = await loadBattlecard(req, competitor._id);
    if (!battlecard) {
      res.status(404).json({ error: "No battlecard yet — generate one first" });
      return;
    }
    const version = Number(req.params.version);
    if (!Number.isInteger(version) || version < 1) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    // Cast: Mongoose's .lean() typing resolves to a union with an array type
    // here; the runtime value is one document.
    const record = (await BattlecardVersion.findOne({
      battlecardId: battlecard._id,
      version,
      ...orgFilter(req),
    }).lean()) as unknown as {
      version: number;
      createdAt: Date;
      content: Record<string, unknown>;
    } | null;
    if (!record) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    res.json({
      version: {
        version: record.version,
        createdAt: record.createdAt.toISOString(),
        content: record.content,
      },
    });
  } catch (err) {
    console.error("Get battlecard version failed:", err);
    res.status(500).json({ error: "Failed to get battlecard version" });
  }
}

// GET /api/battlecards — every battlecard in the organization, with its
// competitor's name (for the /battlecards list page).
export async function listBattlecards(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const battlecards = await Battlecard.find({ ...orgFilter(req) })
      .sort({ updatedAt: -1 })
      .lean();
    const competitorIds = [...new Set(battlecards.map((b) => String(b.competitorId)))];
    const competitors = await Competitor.find({ _id: { $in: competitorIds } })
      .select("_id companyName websiteUrl")
      .lean();
    const byId = new Map(competitors.map((c) => [String(c._id), c]));
    res.json({
      battlecards: battlecards.map((b) => ({
        competitorId: String(b.competitorId),
        competitorName: byId.get(String(b.competitorId))?.companyName,
        websiteUrl: byId.get(String(b.competitorId))?.websiteUrl,
        version: b.version,
        updatedAt: b.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("List battlecards failed:", err);
    res.status(500).json({ error: "Failed to list battlecards" });
  }
}
