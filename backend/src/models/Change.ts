import mongoose, { Document, Schema, Types } from "mongoose";
import type { SnapshotSourceType } from "./Snapshot";

// Phase 5: one Change is one meaningful difference between two consecutive
// snapshots of the same competitor + source type. It is created at scan
// time, right after the new snapshot is stored, by comparing the new
// snapshot's extractedData with the previous successful snapshot's
// (see changes/detector.ts). The first-ever snapshot is a baseline — it
// produces no changes, because there is nothing to compare it with.
//
// Categories (PRD section 9/23): price moves, plans appearing/disappearing,
// new/removed changelog entries and jobs, and new reviews — with new
// low-rated reviews called out separately, because a 1-star review is
// worth more attention than a 5-star one.
//
// Significance is a fixed rule, not a guess: a price increase, a removed
// plan, and a negative review are "high"; a price decrease, a new plan,
// and a new changelog entry are "medium"; everything else is "low".
// Phase 6 (OpenAI) may refine this; Phase 5 keeps it deterministic and
// explainable.

export type ChangeCategory =
  | "price_increase"
  | "price_decrease"
  | "plan_added"
  | "plan_removed"
  | "entry_added"
  | "entry_removed"
  | "job_posted"
  | "job_removed"
  | "review_added"
  | "negative_review";

export type ChangeSignificance = "high" | "medium" | "low";

export interface IChange extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  competitorId: Types.ObjectId;
  snapshotId: Types.ObjectId;
  previousSnapshotId: Types.ObjectId;
  sourceType: SnapshotSourceType;
  category: ChangeCategory;
  significance: ChangeSignificance;
  // One human-readable line, e.g. "Pro plan price rose from $29 to $39".
  title: string;
  // The old and new values behind the title (prices, plan names, ...).
  previousValue?: unknown;
  newValue?: unknown;
  sourceUrl: string;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChangeSchema = new Schema<IChange>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    competitorId: { type: Schema.Types.ObjectId, ref: "Competitor", required: true, index: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "Snapshot", required: true },
    previousSnapshotId: { type: Schema.Types.ObjectId, ref: "Snapshot", required: true },
    sourceType: {
      type: String,
      enum: ["pricing", "changelog", "careers", "reviews"],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "price_increase",
        "price_decrease",
        "plan_added",
        "plan_removed",
        "entry_added",
        "entry_removed",
        "job_posted",
        "job_removed",
        "review_added",
        "negative_review",
      ],
      required: true,
    },
    significance: { type: String, enum: ["high", "medium", "low"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    sourceUrl: { type: String, required: true, trim: true },
    detectedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// The feed query (newest changes per competitor / per organization).
ChangeSchema.index({ competitorId: 1, detectedAt: -1 });
ChangeSchema.index({ organizationId: 1, detectedAt: -1 });

export const Change =
  mongoose.models.Change || mongoose.model<IChange>("Change", ChangeSchema);
