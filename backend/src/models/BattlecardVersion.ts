import mongoose, { Document, Schema, Types } from "mongoose";

// Phase 7: one BattlecardVersion is a full frozen copy of a battlecard at
// one version number. Every generate, regenerate, and edit writes one, so
// "view previous versions" (PRD section 12) always shows exactly what the
// battlecard said at the time — even if the live copy has since changed.
//
// The content is stored schema-less on purpose: it is a snapshot of the
// Battlecard document's sections, and freezing it as Mixed keeps old
// versions readable even if the Battlecard shape gains fields later.

export interface IBattlecardVersion extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  battlecardId: Types.ObjectId;
  competitorId: Types.ObjectId;
  version: number;
  content: Record<string, unknown>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BattlecardVersionSchema = new Schema<IBattlecardVersion>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    battlecardId: { type: Schema.Types.ObjectId, ref: "Battlecard", required: true, index: true },
    competitorId: { type: Schema.Types.ObjectId, ref: "Competitor", required: true, index: true },
    version: { type: Number, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BattlecardVersionSchema.index({ battlecardId: 1, version: -1 });

export const BattlecardVersion =
  mongoose.models.BattlecardVersion ||
  mongoose.model<IBattlecardVersion>("BattlecardVersion", BattlecardVersionSchema);
