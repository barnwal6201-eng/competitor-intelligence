import mongoose, { Document, Schema, Types } from "mongoose";
import type { ChangeCategory } from "./Change";

// Phase 6: one Analysis is one OpenAI run over a set of detected changes
// for one competitor (PRD section 11). It stores structured JSON —
// summary, implications, strengths, weaknesses, suggested sales responses,
// talking points — plus a confidence indicator and the model that produced
// it.
//
// The line between verified facts and AI interpretation is kept explicit:
// the `sources` array is the ground truth (the changes that were actually
// detected, with their titles and URLs), while everything else on this
// document is AI-generated and must be verified before it is used in a
// sales conversation. The UI says so on every analysis. The prompt
// (see ai/analyzer.ts) instructs the model to use only the listed changes
// and never invent prices, features, dates, or quotes.
//
// One analysis covers a fixed set of changes (`changeIds`). A later
// analysis covers only changes no earlier analysis covered, so the same
// change is never analysed twice by default.

export type AnalysisConfidence = "high" | "medium" | "low";

export interface AnalysisSource {
  category: ChangeCategory;
  title: string;
  sourceUrl: string;
}

export interface IAnalysis extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  competitorId: Types.ObjectId;
  changeIds: Types.ObjectId[];
  sources: AnalysisSource[];
  summary: string;
  implications: string[];
  strengths: string[];
  weaknesses: string[];
  suggestedResponses: string[];
  talkingPoints: string[];
  confidence: AnalysisConfidence;
  // Named aiModel, not model: Mongoose documents already have a `model`
  // method, and a `model: string` field breaks the TypeScript interface.
  aiModel: string;
  promptTokens?: number;
  completionTokens?: number;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisSourceSchema = new Schema<AnalysisSource>(
  {
    category: { type: String, required: true },
    title: { type: String, required: true },
    sourceUrl: { type: String, required: true },
  },
  { _id: false }
);

const AnalysisSchema = new Schema<IAnalysis>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    competitorId: { type: Schema.Types.ObjectId, ref: "Competitor", required: true, index: true },
    changeIds: [{ type: Schema.Types.ObjectId, ref: "Change", required: true }],
    sources: { type: [AnalysisSourceSchema], required: true },
    summary: { type: String, required: true, maxlength: 2000 },
    implications: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    suggestedResponses: { type: [String], default: [] },
    talkingPoints: { type: [String], default: [] },
    confidence: { type: String, enum: ["high", "medium", "low"], required: true },
    aiModel: { type: String, required: true, trim: true },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
    generatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// Latest analysis per competitor is the hot query.
AnalysisSchema.index({ competitorId: 1, generatedAt: -1 });

export const Analysis =
  mongoose.models.Analysis || mongoose.model<IAnalysis>("Analysis", AnalysisSchema);
