import type { SnapshotSourceType } from "../models/Snapshot";
import type { ChangeCategory, ChangeSignificance } from "../models/Change";
import type { ChangelogEntry, JobListing, PricePlan, ReviewItem } from "../scrapers/types";

// Phase 5: pure change detection. Compares the extractedData of two
// consecutive snapshots of the same source type and returns the list of
// meaningful changes between them.
//
// Pure by design — no database, no network — so it is unit-testable and
// explainable in an internship review: "this plan cost $29 last scan and
// $39 now, so that is a price_increase with high significance."
//
// Matching is by stable identity, not by position in a list:
//   pricing   — plan name (case-insensitive)
//   changelog — entry title
//   careers   — job title + location
//   reviews   — review text (first 200 chars, normalized)
// Only a price *number* changing counts as a price move; a plan whose
// billing interval text changed but whose price is identical is ignored
// (too noisy to call a change). A plan whose price appears or disappears
// ("Contact sales" → $29, or the reverse) counts as a price move too.
// The first snapshot has no previous data, so detectChanges returns []
// for it — the baseline. Identical data also returns [].

export interface DetectedChange {
  category: ChangeCategory;
  significance: ChangeSignificance;
  title: string;
  previousValue?: unknown;
  newValue?: unknown;
}

function norm(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function priceLabel(plan: PricePlan): string {
  const interval = plan.interval === "month" ? "/month" : plan.interval === "year" ? "/year" : "";
  return plan.raw ? `${plan.raw}${interval && !plan.raw.includes("/") ? interval : ""}` : "no price listed";
}

function asPlans(data: Record<string, unknown> | undefined): PricePlan[] {
  const plans = data?.plans;
  if (!Array.isArray(plans)) return [];
  return plans.filter(
    (p): p is PricePlan =>
      !!p && typeof p === "object" && typeof (p as PricePlan).name === "string"
  );
}

function asEntries(data: Record<string, unknown> | undefined): ChangelogEntry[] {
  const entries = data?.entries;
  if (!Array.isArray(entries)) return [];
  return entries.filter(
    (e): e is ChangelogEntry =>
      !!e && typeof e === "object" && typeof (e as ChangelogEntry).title === "string"
  );
}

function asJobs(data: Record<string, unknown> | undefined): JobListing[] {
  const jobs = data?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.filter(
    (j): j is JobListing =>
      !!j && typeof j === "object" && typeof (j as JobListing).title === "string"
  );
}

function asReviews(data: Record<string, unknown> | undefined): ReviewItem[] {
  const reviews = data?.reviews;
  if (!Array.isArray(reviews)) return [];
  return reviews.filter(
    (r): r is ReviewItem =>
      !!r && typeof r === "object" && typeof (r as ReviewItem).text === "string"
  );
}

function detectPricingChanges(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const prevPlans = new Map(asPlans(previous).map((p) => [norm(p.name), p]));
  const currPlans = new Map(asPlans(current).map((p) => [norm(p.name), p]));

  for (const [key, curr] of currPlans) {
    const prev = prevPlans.get(key);
    if (!prev) {
      changes.push({
        category: "plan_added",
        significance: "medium",
        title: `New plan added: ${curr.name}${curr.price !== null ? ` (${priceLabel(curr)})` : ""}`,
        newValue: curr.name,
      });
      continue;
    }
    if (prev.price === curr.price) continue;
    // A price appeared ("Contact sales" → $29) or disappeared ($29 → "Contact sales").
    if (prev.price === null && curr.price !== null) {
      changes.push({
        category: "price_increase",
        significance: "medium",
        title: `${curr.name} now has a price: ${priceLabel(curr)} (was ${priceLabel(prev)})`,
        previousValue: priceLabel(prev),
        newValue: priceLabel(curr),
      });
    } else if (prev.price !== null && curr.price === null) {
      changes.push({
        category: "price_decrease",
        significance: "medium",
        title: `${curr.name} no longer lists a price (was ${priceLabel(prev)})`,
        previousValue: priceLabel(prev),
        newValue: priceLabel(curr),
      });
    } else if (prev.price !== null && curr.price !== null && curr.price > prev.price) {
      changes.push({
        category: "price_increase",
        significance: "high",
        title: `${curr.name} plan price rose from ${priceLabel(prev)} to ${priceLabel(curr)}`,
        previousValue: prev.price,
        newValue: curr.price,
      });
    } else if (prev.price !== null && curr.price !== null) {
      changes.push({
        category: "price_decrease",
        significance: "medium",
        title: `${curr.name} plan price dropped from ${priceLabel(prev)} to ${priceLabel(curr)}`,
        previousValue: prev.price,
        newValue: curr.price,
      });
    }
  }

  for (const [key, prev] of prevPlans) {
    if (!currPlans.has(key)) {
      changes.push({
        category: "plan_removed",
        significance: "high",
        title: `Plan removed: ${prev.name}${prev.price !== null ? ` (was ${priceLabel(prev)})` : ""}`,
        previousValue: prev.name,
      });
    }
  }
  return changes;
}

function detectChangelogChanges(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const prevTitles = new Set(asEntries(previous).map((e) => norm(e.title)));
  const currTitles = new Set(asEntries(current).map((e) => norm(e.title)));

  for (const entry of asEntries(current)) {
    if (!prevTitles.has(norm(entry.title))) {
      changes.push({
        category: "entry_added",
        significance: "medium",
        title: `New changelog entry: "${entry.title}"${entry.date ? ` (${entry.date})` : ""}`,
        newValue: entry.title,
      });
    }
  }
  for (const entry of asEntries(previous)) {
    if (!currTitles.has(norm(entry.title))) {
      changes.push({
        category: "entry_removed",
        significance: "low",
        title: `Changelog entry removed: "${entry.title}"`,
        previousValue: entry.title,
      });
    }
  }
  return changes;
}

function detectCareersChanges(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const key = (j: JobListing) => `${norm(j.title)}|${norm(j.location ?? "")}`;
  const prevKeys = new Set(asJobs(previous).map(key));
  const currKeys = new Set(asJobs(current).map(key));

  for (const job of asJobs(current)) {
    if (!prevKeys.has(key(job))) {
      changes.push({
        category: "job_posted",
        significance: "low",
        title: `New job posted: ${job.title}${job.location ? ` (${job.location})` : ""}`,
        newValue: job.title,
      });
    }
  }
  for (const job of asJobs(previous)) {
    if (!currKeys.has(key(job))) {
      changes.push({
        category: "job_removed",
        significance: "low",
        title: `Job removed: ${job.title}${job.location ? ` (${job.location})` : ""}`,
        previousValue: job.title,
      });
    }
  }
  return changes;
}

function detectReviewsChanges(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const prevTexts = new Set(asReviews(previous).map((r) => norm(r.text).slice(0, 200)));
  for (const review of asReviews(current)) {
    if (prevTexts.has(norm(review.text).slice(0, 200))) continue;
    const snippet = review.text.replace(/\s+/g, " ").trim().slice(0, 120);
    const rating = review.rating !== null && review.rating !== undefined ? ` (${review.rating}/5)` : "";
    if (review.rating !== null && review.rating !== undefined && review.rating <= 2) {
      changes.push({
        category: "negative_review",
        significance: "high",
        title: `New negative review${rating}: "${snippet}"`,
        newValue: review.rating,
      });
    } else {
      changes.push({
        category: "review_added",
        significance: "low",
        title: `New review${rating}: "${snippet}"`,
        newValue: review.rating ?? undefined,
      });
    }
  }
  return changes;
}

export function detectChanges(
  previousData: Record<string, unknown> | undefined,
  currentData: Record<string, unknown> | undefined,
  sourceType: SnapshotSourceType
): DetectedChange[] {
  // No previous snapshot (first scan) or no previous data: baseline, nothing to compare.
  if (!previousData) return [];
  switch (sourceType) {
    case "pricing":
      return detectPricingChanges(previousData, currentData);
    case "changelog":
      return detectChangelogChanges(previousData, currentData);
    case "careers":
      return detectCareersChanges(previousData, currentData);
    case "reviews":
      return detectReviewsChanges(previousData, currentData);
    default:
      return [];
  }
}
