import mongoose, { Document, Schema, Types } from "mongoose";

export type UserRole = "owner" | "member";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  organizationId: Types.ObjectId;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    // Never returned by default: queries must opt in with .select("+passwordHash").
    passwordHash: { type: String, required: true, select: false },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    role: { type: String, enum: ["owner", "member"], default: "owner" },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
