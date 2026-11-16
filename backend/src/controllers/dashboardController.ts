import type { Response } from "express";
import mongoose from "mongoose";
import { Competitor } from "../models/Competitor";
import { Snapshot } from "../models/Snapshot";
import { Change } from "../models/Change";
import { Battlecard } from "../models/Battlecard";
import { Analysis } from "../models/Analysis";
import type { AuthRequest } from "../middleware/auth";

// Phase 8: the dashboard overview (PRD section 24, MVP). One endpoint
// that answers "what is happening with my competitors right now?" —
// entirely from real data already in MongoDB. No fake numbers anywhere:
// every figure below is a count or an aggregation over the organization's
// own competitors, snapshots, changes, battlecards, and analyses. An
// empty workspace honestly returns zeros and empty lists, not sample data.

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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/dashboard/overview
export async function getDashboardOverview(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const org = orgFilter(req);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
    fourteenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [
      competitors,
      snapshots,
      changes,
      changesLast7Days,
      highChangesLast7Days,
      battlecards,
      analyses,
      perDay,
      topCompetitorsAgg,
      priceMoves,
      recentChanges,
      scanHealthAgg,
    ] = await Promise.all([
      Competitor.countDocuments(org),
      Snapshot.countDocuments(org),
      Change.countDocuments(org),
      Change.countDocuments({ ...org, detectedAt: { $gte: sevenDaysAgo } }),
      Change.countDocuments({ ...org, significance: "high", detectedAt: { $gte: sevenDaysAgo } }),
      Battlecard.countDocuments(org),
      Analysis.countDocuments(org),
      // Changes per day, last 14 days (UTC day buckets).
      Change.aggregate<{ _id: string; count: number }>([
        { $match: { ...org, detectedAt: { $gte: fourteenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$detectedAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Most active competitors by detected-change count.
      Change.aggregate<{ _id: mongoose.Types.ObjectId; changeCount: number; latestChangeAt: Date }>([
        { $match: org },
        { $group: { _id: "$competitorId", changeCount: { $sum: 1 }, latestChangeAt: { $max: "$detectedAt" } } },
        { $sort: { changeCount: -1 } },
        { $limit: 5 },
      ]),
      Change.find({ ...org, category: { $in: ["price_increase", "price_decrease"] } })
        .sort({ detectedAt: -1 })
        .limit(5)
        .lean(),
      Change.find(org).sort({ detectedAt: -1 }).limit(8).lean(),
      // Latest snapshot per competitor (status + time + totals).
      Snapshot.aggregate<{
        _id: mongoose.Types.ObjectId;
        lastScanAt: Date;
        lastScanStatus: string;
        totalSnapshots: number;
      }>([
        { $match: org },
        { $sort: { competitorId: 1, scrapedAt: -1 } },
        {
          $group: {
            _id: "$competitorId",
            lastScanAt: { $first: "$scrapedAt" },
            lastScanStatus: { $first: "$status" },
            totalSnapshots: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Competitor names for the aggregated rows (one lookup, not N).
    const competitorIds = new Set<string>();
    topCompetitorsAgg.forEach((r) => competitorIds.add(String(r._id)));
    priceMoves.forEach((c) => competitorIds.add(String(c.competitorId)));
    recentChanges.forEach((c) => competitorIds.add(String(c.competitorId)));
    scanHealthAgg.forEach((r) => competitorIds.add(String(r._id)));
    const allCompetitors = await Competitor.find({ ...org }).select("_id companyName isMonitoringEnabled").lean();
    const names = new Map(allCompetitors.map((c) => [String(c._id), c.companyName]));
    const monitoringById = new Map(allCompetitors.map((c) => [String(c._id), c.isMonitoringEnabled]));

    // Fill the 14-day series with zeros for quiet days.
    const perDayMap = new Map(perDay.map((r) => [r._id, r.count]));
    const changesPerDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = isoDate(d);
      changesPerDay.push({ date: key, count: perDayMap.get(key) ?? 0 });
    }

    const monitoringEnabled = allCompetitors.filter((c) => c.isMonitoringEnabled).length;

    res.json({
      stats: {
        competitors,
        monitoringEnabled,
        monitoringPaused: competitors - monitoringEnabled,
        snapshots,
        changes,
        changesLast7Days,
        highChangesLast7Days,
        battlecards,
        analyses,
      },
      changesPerDay,
      topCompetitors: topCompetitorsAgg.map((r) => ({
        competitorId: String(r._id),
        competitorName: names.get(String(r._id)),
        changeCount: r.changeCount,
        latestChangeAt: new Date(r.latestChangeAt).toISOString(),
      })),
      priceMoves: priceMoves.map((c) => ({
        id: String(c._id),
        competitorId: String(c.competitorId),
        competitorName: names.get(String(c.competitorId)),
        category: c.category,
        title: c.title,
        significance: c.significance,
        detectedAt: new Date(c.detectedAt).toISOString(),
        sourceUrl: c.sourceUrl,
      })),
      recentChanges: recentChanges.map((c) => ({
        id: String(c._id),
        competitorId: String(c.competitorId),
        competitorName: names.get(String(c.competitorId)),
        category: c.category,
        title: c.title,
        significance: c.significance,
        detectedAt: new Date(c.detectedAt).toISOString(),
        sourceUrl: c.sourceUrl,
      })),
      scanHealth: allCompetitors.map((c) => {
        const row = scanHealthAgg.find((r) => String(r._id) === String(c._id));
        return {
          competitorId: String(c._id),
          competitorName: c.companyName,
          monitoringEnabled: monitoringById.get(String(c._id)) ?? true,
          lastScanAt: row ? new Date(row.lastScanAt).toISOString() : null,
          lastScanStatus: row ? row.lastScanStatus : null,
          totalSnapshots: row ? row.totalSnapshots : 0,
        };
      }),
    });
  } catch (err) {
    console.error("Get dashboard overview failed:", err);
    res.status(500).json({ error: "Failed to load dashboard overview" });
  }
}
