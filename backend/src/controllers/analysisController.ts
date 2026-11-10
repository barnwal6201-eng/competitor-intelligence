import type { Response } from "express";
import mongoose from "mongoose";
import { Competitor } from "../models/Competitor";
import { Change } from "../models/Change";
import { Analysis } from "../models/Analysis";
import { analyzeChanges, type AnalyzedChange } from "../ai/analyzer";
import { hasOpenAIKey, OpenAIError } from "../ai/openaiClient";
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
function publicAnalysis(a: any) {
  return {
    id: String(a._id),
    organizationId: String(a.organizationId),
    competitorId: String(a.competitorId),
    changeIds: (a.changeIds as unknown[]).map(String),
    sources: a.sources,
    summary: a.summary,
    implications: a.implications,
    strengths: a.strengths,
    weaknesses: a.weaknesses,
    suggestedResponses: a.suggestedResponses,
    talkingPoints: a.talkingPoints,
    confidence: a.confidence,
    aiModel: a.aiModel,
    promptTokens: a.promptTokens,
    completionTokens: a.completionTokens,
    generatedAt: a.generatedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
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
  } | null;
  if (!competitor) {
    res.status(404).json({ error: "Competitor not found" });
    return null;
  }
  return competitor;
}

// POST /api/competitors/:id/analyze — run OpenAI over this competitor's
// detected changes and store the structured analysis (PRD section 11).
// Body: optional { changeIds: string[] } to analyse exactly those changes.
// Without a body, it analyses the newest 20 changes no earlier analysis
// has covered yet, so the same change is never analysed twice by default.
// Analysis is manual, not automatic after a scan: each run costs OpenAI
// credits, so the user decides when to spend them (Phase 9 automates it).
// Without OPENAI_API_KEY this returns 503 with setup instructions —
// the app keeps working, only analysis is unavailable.
export async function analyzeCompetitor(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;

    let changes: any[];
    const bodyIds = (req.body as { changeIds?: unknown } | undefined)?.changeIds;
    if (bodyIds !== undefined) {
      if (!Array.isArray(bodyIds) || bodyIds.length === 0 || bodyIds.length > 20) {
        res.status(400).json({ error: "changeIds must be an array of 1–20 change IDs" });
        return;
      }
      if (!bodyIds.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
        res.status(400).json({ error: "changeIds must be an array of 1–20 change IDs" });
        return;
      }
      changes = await Change.find({
        _id: { $in: bodyIds },
        competitorId: competitor._id,
        ...orgFilter(req),
      })
        .sort({ detectedAt: -1 })
        .lean();
      if (changes.length !== bodyIds.length) {
        res.status(400).json({ error: "One or more change IDs are invalid for this competitor" });
        return;
      }
    } else {
      const covered = await Analysis.distinct("changeIds", { competitorId: competitor._id });
      changes = await Change.find({
        competitorId: competitor._id,
        ...orgFilter(req),
        _id: { $nin: covered },
      })
        .sort({ detectedAt: -1 })
        .limit(20)
        .lean();
    }

    if (changes.length === 0) {
      res.json({
        analysis: null,
        message: "No new changes to analyse — every detected change is already covered by an earlier analysis.",
      });
      return;
    }
    if (!hasOpenAIKey()) {
      res.status(503).json({
        error:
          "OpenAI API key is not configured — add OPENAI_API_KEY to backend/.env and restart the backend. Get a key at platform.openai.com (API keys). Note: a ChatGPT subscription does not include API credits; the API needs its own billing.",
      });
      return;
    }

    const analyzed: AnalyzedChange[] = changes.map((c) => ({
      sourceType: c.sourceType,
      category: c.category,
      significance: c.significance,
      title: c.title,
      previousValue: c.previousValue,
      newValue: c.newValue,
      sourceUrl: c.sourceUrl,
      detectedAt: c.detectedAt,
    }));
    const { analysis, usage } = await analyzeChanges(competitor.companyName, analyzed);
    const saved = await Analysis.create({
      organizationId: new mongoose.Types.ObjectId(req.user!.organizationId),
      competitorId: competitor._id,
      changeIds: changes.map((c) => c._id),
      sources: changes.map((c) => ({
        category: c.category,
        title: c.title,
        sourceUrl: c.sourceUrl,
      })),
      summary: analysis.summary,
      implications: analysis.implications,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      suggestedResponses: analysis.suggestedResponses,
      talkingPoints: analysis.talkingPoints,
      confidence: analysis.confidence,
      aiModel: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      generatedAt: new Date(),
    });
    res.json({ analysis: publicAnalysis(saved) });
  } catch (err) {
    if (err instanceof OpenAIError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Analyse competitor failed:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
}

// GET /api/competitors/:id/analyses — analysis history for one competitor,
// newest first. Optional ?limit= (default 10, max 50).
export async function listAnalyses(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const analyses = await Analysis.find({ competitorId: competitor._id, ...orgFilter(req) })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ analyses: analyses.map(publicAnalysis) });
  } catch (err) {
    console.error("List analyses failed:", err);
    res.status(500).json({ error: "Failed to list analyses" });
  }
}

// GET /api/competitors/:id/analyses/:analysisId — one analysis.
export async function getAnalysis(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const competitor = await loadCompetitor(req, res);
    if (!competitor) return;
    const analysisId = req.params.analysisId as string;
    if (!mongoose.isValidObjectId(analysisId)) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    const analysis = await Analysis.findOne({
      _id: analysisId,
      competitorId: competitor._id,
      ...orgFilter(req),
    }).lean();
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    res.json({ analysis: publicAnalysis(analysis) });
  } catch (err) {
    console.error("Get analysis failed:", err);
    res.status(500).json({ error: "Failed to get analysis" });
  }
}
