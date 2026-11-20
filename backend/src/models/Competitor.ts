import mongoose, { Document, Schema, Types } from "mongoose";

export type MonitoringFrequency = "hourly" | "daily" | "weekly";

export interface ICompetitor extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  companyName: string;
  websiteUrl: string;
  pricingPageUrl?: string;
  changelogUrl?: string;
  careersPageUrl?: string;
  reviewSourceUrl?: string;
  monitoringFrequency: MonitoringFrequency;
  isMonitoringEnabled: boolean;
  // Phase 9: last background/manual scan outcome, updated by the worker
  // (or by the synchronous fallback). The dashboard's scan-health table
  // reads the latest Snapshot for this, but these fields give the
  // competitor list a cheap answer without an aggregation.
  lastScannedAt?: Date;
  lastScanStatus?: "success" | "partial" | "failed";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const urlValidator = {
  validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
  message: "URL must start with http:// or https://",
};

const CompetitorSchema = new Schema<ICompetitor>(
  {
    // Organization-level isolation (PRD sections 2 and 17): every query for
    // competitors must filter by organizationId. CRUD routes in Phase 3 enforce this.
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    companyName: { type: String, required: true, trim: true, maxlength: 100 },
    websiteUrl: { type: String, required: true, trim: true, validate: urlValidator },
    pricingPageUrl: { type: String, trim: true, validate: urlValidator },
    changelogUrl: { type: String, trim: true, validate: urlValidator },
    careersPageUrl: { type: String, trim: true, validate: urlValidator },
    reviewSourceUrl: { type: String, trim: true, validate: urlValidator },
    monitoringFrequency: { type: String, enum: ["hourly", "daily", "weekly"], default: "daily" },
    isMonitoringEnabled: { type: Boolean, default: true },
    lastScannedAt: { type: Date },
    lastScanStatus: { type: String, enum: ["success", "partial", "failed"] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One competitor website per organization — prevents duplicate monitoring.
CompetitorSchema.index({ organizationId: 1, websiteUrl: 1 }, { unique: true });
CompetitorSchema.index({ organizationId: 1, companyName: 1 });

export const Competitor =
  mongoose.models.Competitor || mongoose.model<ICompetitor>("Competitor", CompetitorSchema);
