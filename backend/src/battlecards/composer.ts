import type { ICompetitor } from "../models/Competitor";
import type { ISnapshot } from "../models/Snapshot";
import type { IChange } from "../models/Change";
import type { IAnalysis } from "../models/Analysis";
import type {
  BattlecardComplaint,
  BattlecardFeature,
  BattlecardPlan,
  BattlecardRecentChange,
  BattlecardSource,
} from "../models/Battlecard";

// Phase 7: the battlecard composer (PRD section 12). Pure function — no
// database, no network — so it is unit-testable: give it a competitor, its
// latest snapshots, its recent changes, and optionally its latest AI
// analysis, and it returns the battlecard sections.
//
// Everything in the result is traceable to its input:
//   - pricing plans, features, recent changes, and complaints come from
//     the snapshots/changes (verified data) and are NOT editable later.
//   - strengths, weaknesses, talking points, objection handling, and the
//     positioning line come from the latest analysis when one exists
//     (AI-generated, editable, labelled as such in the UI). With no
//     analysis yet those sections are empty — the composer never invents
//     them from nothing.

export interface BattlecardContent {
  overview: string;
  positioning: string;
  pricing: BattlecardPlan[];
  pricingSourceUrl?: string;
  pricingSnapshotDate?: Date;
  features: BattlecardFeature[];
  strengths: string[];
  weaknesses: string[];
  recentChanges: BattlecardRecentChange[];
  complaints: BattlecardComplaint[];
  talkingPoints: string[];
  objectionHandling: string[];
  sources: BattlecardSource[];
  aiSections: string[];
  generatedFromAnalysisId: unknown;
}

export interface ComposerInput {
  competitor: ICompetitor;
  latestSnapshots: Partial<Record<"pricing" | "changelog" | "careers" | "reviews", ISnapshot>>;
  recentChanges: IChange[];
  latestAnalysis: IAnalysis | null;
}

function asPlans(snapshot?: ISnapshot): BattlecardPlan[] {
  const data = (snapshot?.extractedData ?? {}) as Record<string, unknown>;
  if (!Array.isArray(data.plans)) return [];
  return (data.plans as Record<string, unknown>[])
    .filter((p) => typeof p?.name === "string")
    .map((p) => ({
      name: String(p.name),
      price: typeof p.price === "number" ? p.price : null,
      currency: typeof p.currency === "string" ? p.currency : null,
      interval: typeof p.interval === "string" ? p.interval : "unknown",
      raw: typeof p.raw === "string" ? p.raw : String(p.name),
    }));
}

function asFeatures(snapshot?: ISnapshot): BattlecardFeature[] {
  const data = (snapshot?.extractedData ?? {}) as Record<string, unknown>;
  if (!Array.isArray(data.entries)) return [];
  return (data.entries as Record<string, unknown>[])
    .filter((e) => typeof e?.title === "string")
    .slice(0, 10)
    .map((e) => ({
      title: String(e.title),
      date: typeof e.date === "string" ? e.date : null,
    }));
}

function asComplaints(snapshot?: ISnapshot): BattlecardComplaint[] {
  const data = (snapshot?.extractedData ?? {}) as Record<string, unknown>;
  if (!Array.isArray(data.reviews)) return [];
  return (data.reviews as Record<string, unknown>[])
    .filter(
      (r) =>
        typeof r?.text === "string" &&
        typeof r?.rating === "number" &&
        (r.rating as number) <= 2
    )
    .slice(0, 5)
    .map((r) => ({ text: String(r.text), rating: r.rating as number }));
}

export function composeBattlecard(input: ComposerInput): BattlecardContent {
  const { competitor, latestSnapshots, recentChanges, latestAnalysis } = input;
  const pricing = asPlans(latestSnapshots.pricing);
  const features = asFeatures(latestSnapshots.changelog);
  const complaints = asComplaints(latestSnapshots.reviews);

  const watched: string[] = ["website"];
  if (competitor.pricingPageUrl || competitor.websiteUrl) watched.push("pricing");
  if (competitor.changelogUrl) watched.push("changelog");
  if (competitor.careersPageUrl) watched.push("careers");
  if (competitor.reviewSourceUrl) watched.push("reviews");

  const trackedSince = new Date(competitor.createdAt).toLocaleDateString();
  const latestScan = [latestSnapshots.pricing, latestSnapshots.changelog, latestSnapshots.reviews]
    .map((s) => s?.scrapedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const overview =
    `${competitor.companyName} (${competitor.websiteUrl}) — tracked since ${trackedSince}. ` +
    `Monitoring ${watched.join(", ")}.` +
    (latestScan ? ` Last successful scan: ${new Date(latestScan).toLocaleString()}.` : " No successful scan yet.");

  // Positioning is pricing-derived, extended by the AI summary when one exists.
  let positioning = "";
  const priced = pricing.filter((p) => p.price !== null) as { price: number }[];
  if (pricing.length > 0 && priced.length > 0) {
    const prices = priced.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    positioning = `${pricing.length} plan${pricing.length === 1 ? "" : "s"} from $${min} to $${max}.`;
  } else if (pricing.length > 0) {
    positioning = `${pricing.length} plan${pricing.length === 1 ? "" : "s"} listed (no numeric prices found).`;
  } else {
    positioning = "No pricing data captured yet — scan the competitor first.";
  }
  if (latestAnalysis) {
    positioning += ` ${latestAnalysis.summary}`;
  }

  const sources: BattlecardSource[] = [{ label: "Website", url: competitor.websiteUrl }];
  if (competitor.pricingPageUrl) sources.push({ label: "Pricing page", url: competitor.pricingPageUrl });
  if (competitor.changelogUrl) sources.push({ label: "Changelog", url: competitor.changelogUrl });
  if (competitor.careersPageUrl) sources.push({ label: "Careers page", url: competitor.careersPageUrl });
  if (competitor.reviewSourceUrl) sources.push({ label: "Review source", url: competitor.reviewSourceUrl });

  const aiSections = latestAnalysis
    ? ["positioning", "strengths", "weaknesses", "talkingPoints", "objectionHandling"]
    : [];

  return {
    overview,
    positioning,
    pricing,
    pricingSourceUrl: latestSnapshots.pricing?.sourceUrl,
    pricingSnapshotDate: latestSnapshots.pricing?.scrapedAt,
    features,
    strengths: latestAnalysis ? [...latestAnalysis.strengths] : [],
    weaknesses: latestAnalysis ? [...latestAnalysis.weaknesses] : [],
    recentChanges: recentChanges.slice(0, 10).map((c) => ({
      category: c.category,
      title: c.title,
      significance: c.significance,
      detectedAt: c.detectedAt,
      sourceUrl: c.sourceUrl,
    })),
    complaints,
    talkingPoints: latestAnalysis ? [...latestAnalysis.talkingPoints] : [],
    objectionHandling: latestAnalysis ? [...latestAnalysis.suggestedResponses] : [],
    sources,
    aiSections,
    generatedFromAnalysisId: latestAnalysis ? latestAnalysis._id : null,
  };
}
