import mongoose, { Document, Schema, Types } from "mongoose";

// Phase 9: one ScanJob is one queued scan of one competitor, manual or
// scheduled. BullMQ holds the live job in Redis, but Redis is volatile —
// this MongoDB record is the durable audit trail: what was queued, when,
// by whom (manual vs scheduled), whether it ran, and what it found.
// The frontend polls this record, not Redis, so a job stays visible
// even after Redis restarts or the queue is cleared.
export type ScanJobTrigger = "manual" | "scheduled";
export type ScanJobStatus = "queued" | "active" | "completed" | "failed";

export interface IScanJob extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  competitorId: Types.ObjectId;
  bullmqJobId: string;
  trigger: ScanJobTrigger;
  status: ScanJobStatus;
  // Summary of runScanForCompetitor, stored when the job completes.
  resultSummary?: {
    scannedAt: string;
    results: { sourceType: string; outcome: string; changesDetected?: number; message?: string }[];
  };
  errorMessage?: string;
  // BullMQ attempt count (1 on first try; higher after retries).
  attemptsMade?: number;
  queuedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScanJobSchema = new Schema<IScanJob>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    competitorId: { type: Schema.Types.ObjectId, ref: "Competitor", required: true, index: true },
    bullmqJobId: { type: String, required: true, trim: true },
    trigger: { type: String, enum: ["manual", "scheduled"], required: true },
    status: { type: String, enum: ["queued", "active", "completed", "failed"], default: "queued", index: true },
    resultSummary: { type: Schema.Types.Mixed },
    errorMessage: { type: String, maxlength: 500 },
    attemptsMade: { type: Number },
    queuedAt: { type: Date, required: true, default: () => new Date() },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

ScanJobSchema.index({ organizationId: 1, competitorId: 1, queuedAt: -1 });
ScanJobSchema.index({ bullmqJobId: 1 }, { unique: true });

export const ScanJob =
  mongoose.models.ScanJob || mongoose.model<IScanJob>("ScanJob", ScanJobSchema);
