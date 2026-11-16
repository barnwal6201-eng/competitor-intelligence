import mongoose, { Document, Schema, Types } from "mongoose";
import type { ChangeCategory } from "./Change";

// Phase 7: one Battlecard per competitor per organization (PRD section 12).
// It is a sales-ready summary assembled ONLY from real data the system
// already holds — never typed up by hand, never invented:
//
//   Verified data (from the latest snapshots + detected changes):
//     pricing plans, changelog features, recent changes, customer
//     complaints (reviews rated 2 or below). These sections are read-only:
//     editing them would mean faking data, so the only way they change is
//     a new scan (or a Regenerate, which re-reads the latest data).
//   AI data (from the latest OpenAI analysis, Phase 6):
//     strengths, weaknesses, talking points, objection handling, and the
//     positioning line. These are editable, and the UI labels them
//     AI-generated. With no analysis yet they stay empty with a note
//     telling the user to run Analyse first.
//
// Every generate / regenerate / edit bumps `version` and writes a full
// copy to BattlecardVersion, so previous versions can always be read back.

export interface BattlecardPlan {
  name: string;
  price: number | null;
  currency: string | null;
  interval: string;
  raw: string;
}

export interface BattlecardFeature {
  title: string;
  date: string | null;
}

export interface BattlecardRecentChange {
  category: ChangeCategory;
  title: string;
  significance: "high" | "medium" | "low";
  detectedAt: Date;
  sourceUrl: string;
}

export interface BattlecardComplaint {
  text: string;
  rating: number | null;
}

export interface BattlecardSource {
  label: string;
  url: string;
}

export interface IBattlecard extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  competitorId: Types.ObjectId;
  version: number;
  generatedFromAnalysisId?: Types.ObjectId | null;
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
  // Which sections came from AI (vs verified data): shown in the UI so a
  // salesperson knows what to verify before a call.
  aiSections: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<BattlecardPlan>(
  {
    name: { type: String, required: true },
    price: { type: Number, default: null },
    currency: { type: String, default: null },
    interval: { type: String, required: true },
    raw: { type: String, required: true },
  },
  { _id: false }
);

const FeatureSchema = new Schema<BattlecardFeature>(
  {
    title: { type: String, required: true },
    date: { type: String, default: null },
  },
  { _id: false }
);

const RecentChangeSchema = new Schema<BattlecardRecentChange>(
  {
    category: { type: String, required: true },
    title: { type: String, required: true },
    significance: { type: String, enum: ["high", "medium", "low"], required: true },
    detectedAt: { type: Date, required: true },
    sourceUrl: { type: String, required: true },
  },
  { _id: false }
);

const ComplaintSchema = new Schema<BattlecardComplaint>(
  {
    text: { type: String, required: true },
    rating: { type: Number, default: null },
  },
  { _id: false }
);

const SourceSchema = new Schema<BattlecardSource>(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const BattlecardSchema = new Schema<IBattlecard>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    competitorId: { type: Schema.Types.ObjectId, ref: "Competitor", required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    generatedFromAnalysisId: { type: Schema.Types.ObjectId, ref: "Analysis", default: null },
    overview: { type: String, required: true, maxlength: 2000 },
    positioning: { type: String, required: true, maxlength: 2000 },
    pricing: { type: [PlanSchema], default: [] },
    pricingSourceUrl: { type: String },
    pricingSnapshotDate: { type: Date },
    features: { type: [FeatureSchema], default: [] },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recentChanges: { type: [RecentChangeSchema], default: [] },
    complaints: { type: [ComplaintSchema], default: [] },
    talkingPoints: { type: [String], default: [] },
    objectionHandling: { type: [String], default: [] },
    sources: { type: [SourceSchema], default: [] },
    aiSections: { type: [String], default: [] },
  },
  { timestamps: true }
);

// One battlecard per competitor per organization.
BattlecardSchema.index({ organizationId: 1, competitorId: 1 }, { unique: true });

export const Battlecard =
  mongoose.models.Battlecard || mongoose.model<IBattlecard>("Battlecard", BattlecardSchema);
