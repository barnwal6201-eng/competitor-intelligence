import type { SnapshotSourceType } from "../models/Snapshot";

// Shared types for the scraping engine (PRD section 9).

export type { SnapshotSourceType };

export interface PricePlan {
  name: string;
  price: number | null;
  currency: string | null;
  interval: "month" | "year" | "one-time" | "unknown";
  raw: string;
}

export interface ChangelogEntry {
  title: string;
  date: string | null;
  description: string;
}

export interface JobListing {
  title: string;
  location: string | null;
  url: string | null;
}

export interface ReviewItem {
  text: string;
  rating: number | null;
}

export type ExtractedData =
  | { plans: PricePlan[] }
  | { entries: ChangelogEntry[] }
  | { jobs: JobListing[] }
  | { reviews: ReviewItem[]; averageRating: number | null };

export interface ScrapeResult {
  sourceType: SnapshotSourceType;
  sourceUrl: string;
  data: ExtractedData;
  // Normalized visible text of the page — hashed for dedupe/change detection.
  normalizedText: string;
}

// A scraper takes a page URL and returns normalized structured data.
export type Scraper = (url: string) => Promise<ScrapeResult>;

export class ScrapeError extends Error {
  status: "failed" | "blocked";
  constructor(message: string, status: "failed" | "blocked" = "failed") {
    super(message);
    this.status = status;
  }
}
