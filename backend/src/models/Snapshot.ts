import mongoose, { Document, Schema, Types } from "mongoose";

// Phase 4: one Snapshot is one scrape of one source page of one competitor.
// Change detection (Phase 5) compares snapshots; this phase only stores them.
// A snapshot whose contentHash matches the previous snapshot for the same
// competitor + source type is not stored again — the scan reports it as
// "unchanged" instead (see scrapers/index.ts).

export type SnapshotSourceType = "pricing" | "changelog" | "careers" | "reviews";
export type SnapshotStatus = "success" | "failed" | "blocked";

export interface ISnapshot extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  competitorId: Types.ObjectId;
  sourceType: SnapshotSourceType;
  sourceUrl: string;
  status: SnapshotStatus;
  contentHash?: string;
  // Normalized structured data from the scraper (plans, entries, jobs, ...).
  // Schema-less on purpose: each source type extracts different fields.
  extractedData?: Record<string, unknown>;
  // First ~2,000 characters of the page's normalized text, for display and
  // debugging. The full page is NOT stored — snapshots stay small.
  textPreview?: string;
  errorMessage?: string;
  scrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotSchema = new Schema<ISnapshot>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    competitorId: { type: Schema.Types.ObjectId, ref: "Competitor", required: true, index: true },
    sourceType: {
      type: String,
      enum: ["pricing", "changelog", "careers", "reviews"],
      required: true,
    },
    sourceUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: ["success", "failed", "blocked"], required: true },
    contentHash: { type: String, trim: true },
    extractedData: { type: Schema.Types.Mixed },
    textPreview: { type: String, maxlength: 2000 },
    errorMessage: { type: String, maxlength: 500 },
    scrapedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// Latest snapshot per competitor + source type is the hot query (dedupe check
// in the scanner, and the snapshot history page).
SnapshotSchema.index({ competitorId: 1, sourceType: 1, scrapedAt: -1 });

export const Snapshot =
  mongoose.models.Snapshot || mongoose.model<ISnapshot>("Snapshot", SnapshotSchema);
