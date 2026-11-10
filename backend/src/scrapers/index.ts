import crypto from "node:crypto";
import { Snapshot, type SnapshotSourceType } from "../models/Snapshot";
import { Change } from "../models/Change";
import { detectChanges } from "../changes/detector";
import type { ICompetitor } from "../models/Competitor";
import { scrapePricing } from "./pricingScraper";
import { scrapeChangelog } from "./changelogScraper";
import { scrapeCareers } from "./careersScraper";
import { scrapeReviews } from "./reviewsScraper";
import { ScrapeError, type Scraper } from "./types";

// Runs one scan of a competitor: fetches each configured source page,
// extracts structured data, and stores a Snapshot per source (PRD section 9).
//
// - Pricing uses pricingPageUrl, falling back to the main website.
// - Changelog, careers, and reviews only run when their URL is set.
// - A source whose page text is unchanged since the last snapshot is NOT
//   stored again — it is reported as "unchanged". Change detection (Phase 5)
//   builds on exactly this hash comparison.
// - One source failing (or being blocked by robots.txt) does not stop the
//   others; the failure is stored as a snapshot so the history shows it.
// - Scanning runs inside the API request in Phase 4. Phase 9 moves it to
//   Redis + BullMQ background jobs.

const SCRAPERS: Record<SnapshotSourceType, Scraper> = {
  pricing: scrapePricing,
  changelog: scrapeChangelog,
  careers: scrapeCareers,
  reviews: scrapeReviews,
};

export interface ScanSourceResult {
  sourceType: SnapshotSourceType;
  sourceUrl: string;
  outcome: "created" | "unchanged" | "failed" | "blocked";
  snapshotId?: string;
  contentHash?: string;
  // Phase 5: how many meaningful changes this scan detected vs the
  // previous snapshot (0 on a first scan — the baseline — and on rescan
  // the detector only runs when a new snapshot is actually stored).
  changesDetected?: number;
  message?: string;
}

export interface ScanSummary {
  competitorId: string;
  scannedAt: string;
  results: ScanSourceResult[];
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export async function runScanForCompetitor(competitor: ICompetitor): Promise<ScanSummary> {
  const organizationId = competitor.organizationId;
  const targets: { sourceType: SnapshotSourceType; url: string }[] = [];
  if (competitor.pricingPageUrl || competitor.websiteUrl) {
    targets.push({ sourceType: "pricing", url: competitor.pricingPageUrl || competitor.websiteUrl });
  }
  if (competitor.changelogUrl) targets.push({ sourceType: "changelog", url: competitor.changelogUrl });
  if (competitor.careersPageUrl) targets.push({ sourceType: "careers", url: competitor.careersPageUrl });
  if (competitor.reviewSourceUrl) targets.push({ sourceType: "reviews", url: competitor.reviewSourceUrl });

  const results = await Promise.all(
    targets.map(async ({ sourceType, url }): Promise<ScanSourceResult> => {
      try {
        const result = await SCRAPERS[sourceType](url);
        const contentHash = hashText(result.normalizedText);
        // Cast: Mongoose's .lean() typing for findOne + sort resolves to a
        // union with an array type here; the runtime value is one document.
        const previous = (await Snapshot.findOne({ competitorId: competitor._id, sourceType })
          .sort({ scrapedAt: -1 })
          .lean()) as unknown as { _id: unknown; contentHash?: string } | null;
        if (previous?.contentHash === contentHash) {
          return {
            sourceType,
            sourceUrl: url,
            outcome: "unchanged",
            snapshotId: String(previous._id),
            contentHash,
            message: "Page has not changed since the last scan",
          };
        }
        const snapshot = await Snapshot.create({
          organizationId,
          competitorId: competitor._id,
          sourceType,
          sourceUrl: url,
          status: "success",
          contentHash,
          extractedData: result.data,
          textPreview: result.normalizedText.slice(0, 2000),
          scrapedAt: new Date(),
        });
        // Phase 5: compare with the previous *successful* snapshot (a
        // failed/blocked one has no data to compare against) and store
        // every meaningful change. First scan: no previous snapshot, so
        // the baseline produces zero changes.
        let changesDetected = 0;
        const previousSuccess = (await Snapshot.findOne({
          competitorId: competitor._id,
          sourceType,
          status: "success",
          _id: { $ne: snapshot._id },
        })
          .sort({ scrapedAt: -1 })
          .lean()) as unknown as { _id: unknown; extractedData?: Record<string, unknown> } | null;
        if (previousSuccess?.extractedData) {
          const detected = detectChanges(
            previousSuccess.extractedData,
            result.data as unknown as Record<string, unknown>,
            sourceType
          );
          if (detected.length > 0) {
            await Change.insertMany(
              detected.map((d) => ({
                organizationId,
                competitorId: competitor._id,
                snapshotId: snapshot._id,
                previousSnapshotId: previousSuccess._id,
                sourceType,
                category: d.category,
                significance: d.significance,
                title: d.title,
                previousValue: d.previousValue,
                newValue: d.newValue,
                sourceUrl: url,
                detectedAt: new Date(),
              }))
            );
            changesDetected = detected.length;
          }
        }
        return {
          sourceType,
          sourceUrl: url,
          outcome: "created",
          snapshotId: String(snapshot._id),
          contentHash,
          changesDetected,
        };
      } catch (err) {
        const isBlocked = err instanceof ScrapeError && err.status === "blocked";
        const message = err instanceof Error ? err.message : "Scrape failed";
        const snapshot = await Snapshot.create({
          organizationId,
          competitorId: competitor._id,
          sourceType,
          sourceUrl: url,
          status: isBlocked ? "blocked" : "failed",
          errorMessage: message.slice(0, 500),
          scrapedAt: new Date(),
        });
        return {
          sourceType,
          sourceUrl: url,
          outcome: isBlocked ? "blocked" : "failed",
          snapshotId: String(snapshot._id),
          message,
        };
      }
    })
  );

  return {
    competitorId: String(competitor._id),
    scannedAt: new Date().toISOString(),
    results,
  };
}
