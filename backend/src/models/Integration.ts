// Phase 10: one Integration is one connected third-party account for one
// organization — a Notion workspace or a Salesforce org.
//
// Tokens are stored ENCRYPTED (see integrations/crypto.ts), never plain
// text, and never leave the backend: the API only ever returns the
// provider, status, account name, and last-push bookkeeping. One row per
// provider per organization — reconnecting replaces the old tokens.
// `settings.notionParentPageId` remembers where battlecards go in Notion,
// so the user pastes the parent page id only once.

import mongoose, { Document, Schema, Types } from "mongoose";

export type IntegrationProvider = "notion" | "salesforce";
export type IntegrationStatus = "connected" | "error";

export interface IIntegration extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  // Encrypted with AES-256-GCM (integrations/crypto.ts). Never plain text.
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string | null;
  expiresAt?: Date | null;
  // Where the token is valid: Notion workspace id / Salesforce instance URL.
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  instanceUrl?: string | null;
  // Last successful push (any kind), for the settings page.
  lastPushAt?: Date | null;
  lastPushTarget?: string | null;
  lastPushKind?: "battlecard" | "change" | null;
  settings: {
    notionParentPageId?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    provider: { type: String, enum: ["notion", "salesforce"], required: true },
    status: { type: String, enum: ["connected", "error"], required: true, default: "connected" },
    accessTokenEncrypted: { type: String, required: true },
    refreshTokenEncrypted: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    externalAccountId: { type: String, default: null },
    externalAccountName: { type: String, default: null },
    instanceUrl: { type: String, default: null },
    lastPushAt: { type: Date, default: null },
    lastPushTarget: { type: String, default: null },
    lastPushKind: { type: String, enum: ["battlecard", "change", null], default: null },
    settings: {
      notionParentPageId: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// One connected account per provider per organization.
IntegrationSchema.index({ organizationId: 1, provider: 1 }, { unique: true });

export const Integration =
  mongoose.models.Integration || mongoose.model<IIntegration>("Integration", IntegrationSchema);
