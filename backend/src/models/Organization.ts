import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

OrganizationSchema.index({ name: 1 });

export const Organization =
  mongoose.models.Organization || mongoose.model<IOrganization>("Organization", OrganizationSchema);
