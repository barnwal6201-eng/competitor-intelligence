// Phase 10: token encryption for connected integrations.
//
// OAuth access/refresh tokens are secrets — they must never sit in
// MongoDB as plain text, where a database leak would hand over the
// user's Notion workspace and Salesforce org. They are encrypted with
// AES-256-GCM using INTEGRATION_ENCRYPTION_KEY (a 64-hex-char key,
// i.e. 32 random bytes — generate with
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// and put it in backend/.env). Each encryption uses a fresh random IV,
// and the GCM auth tag is stored alongside the ciphertext, so tampering
// is detected on decrypt.
//
// The key is read at call time, not cached at import, so tests can set
// it per-run. Connecting an integration without a valid key is refused
// with a plain-English 503 (see the controller), never silently stored
// unencrypted.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

export class IntegrationCryptoError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}

export function getEncryptionKey(): Buffer {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new IntegrationCryptoError(
      "INTEGRATION_ENCRYPTION_KEY is not set — generate a 64-character hex key (node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\") and add it to backend/.env before connecting Notion or Salesforce"
    );
  }
  return Buffer.from(hex, "hex");
}

export function hasEncryptionKey(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || "");
}

// Format: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext).
export function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptToken(packed: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = packed.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new IntegrationCryptoError("Stored token is corrupt — disconnect and reconnect the integration", 500);
  }
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new IntegrationCryptoError(
      "Stored token could not be decrypted — the encryption key may have changed. Disconnect and reconnect the integration",
      500
    );
  }
}
