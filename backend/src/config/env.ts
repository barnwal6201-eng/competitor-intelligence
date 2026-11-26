import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret) {
  if (process.env.NODE_ENV === "production") {
    // In production there is no safe fallback: a known default secret
    // would let anyone forge login tokens for any account.
    throw new Error(
      "JWT_SECRET is not set. Set a long random JWT_SECRET in the environment before starting in production — see backend/.env.example."
    );
  }
  console.warn(
    "WARNING: JWT_SECRET is not set. Using a dev-only fallback secret. " +
      "Set a long random JWT_SECRET in backend/.env before any real use — see backend/.env.example."
  );
}

// Render's Blueprint wires FRONTEND_URL from the frontend service's
// hostname — a bare host like xxx.onrender.com with no protocol — and
// CORS needs a full origin, so https:// is added when no protocol is
// present. A full URL (local dev's http://localhost:3000, or a pasted
// https:// URL) passes through unchanged. A trailing slash is stripped
// because CORS compares the origin exactly.
function normalizeOrigin(value: string | undefined): string {
  const v = value?.trim().replace(/\/+$/, "");
  if (!v) return "";
  return v.includes("://") ? v : `https://${v}`;
}

export const env = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: normalizeOrigin(process.env.FRONTEND_URL) || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri: process.env.MONGODB_URI || "",
  // Dev fallback only; production must set JWT_SECRET (see .env.example).
  jwtSecret: jwtSecret || "dev-only-secret-change-me-in-production",
  jwtExpiresInDays: 7,
  // Phase 6: Groq AI analysis (the provider is Groq, reached through its
  // OpenAI-compatible API — the env var names still say OPENAI_ because
  // the code was written for OpenAI first). The key is optional — without
  // it the app works and only POST /api/competitors/:id/analyze returns
  // 503. The key is read from process.env at call time in
  // ai/openaiClient.ts, not cached here, so tests can set it per-run;
  // these fields document the setting.
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "openai/gpt-oss-120b",
  // Phase 9: Redis + BullMQ. Redis is optional — without it the app still
  // starts and manual scans run synchronously (Phase 4 behaviour); with
  // it, scans run as background jobs and repeat on schedule. The worker
  // runs in the API process by default in development
  // (SCAN_WORKER_IN_PROCESS=true); in production set it to "false" and
  // run the separate worker with `npm run worker` instead.
  redisUrl: process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379",
  scanWorkerInProcess: process.env.SCAN_WORKER_IN_PROCESS !== "false",
  scanWorkerConcurrency: Number(process.env.SCAN_WORKER_CONCURRENCY || 2),
  // Phase 10: Notion / Salesforce OAuth. The keys are read from
  // process.env at call time in the integration clients, not cached
  // here, so tests can point them at mock servers per-run; these
  // fields only document the settings (see backend/.env.example).
  isProduction: process.env.NODE_ENV === "production",
};

// Production sanity warnings (non-fatal): a production API that still
// points at the localhost frontend would reject every real request
// with a CORS error, and a dev fallback JWT secret was already refused
// above. These print once at startup so a misconfigured deploy is
// obvious in the logs instead of failing silently for users.
if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
  console.warn(
    "WARNING: FRONTEND_URL is not set in production — CORS defaults to http://localhost:3000, " +
      "so the deployed frontend will be blocked. Set FRONTEND_URL to the deployed frontend URL."
  );
}
