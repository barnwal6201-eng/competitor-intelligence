import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret) {
  console.warn(
    "WARNING: JWT_SECRET is not set. Using a dev-only fallback secret. " +
      "Set a long random JWT_SECRET in backend/.env before any real use — see backend/.env.example."
  );
}

export const env = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri: process.env.MONGODB_URI || "",
  // Dev fallback only; production must set JWT_SECRET (see .env.example).
  jwtSecret: jwtSecret || "dev-only-secret-change-me-in-production",
  jwtExpiresInDays: 7,
  // Phase 6: OpenAI. The key is optional — without it the app works and
  // only POST /api/competitors/:id/analyze returns 503. The key is read
  // from process.env at call time in ai/openaiClient.ts, not cached here,
  // so tests can set it per-run; these fields document the setting.
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  // Phase 9: Redis + BullMQ. Redis is optional — without it the app still
  // starts and manual scans run synchronously (Phase 4 behaviour); with
  // it, scans run as background jobs and repeat on schedule. The worker
  // runs in the API process by default in development
  // (SCAN_WORKER_IN_PROCESS=true); in production set it to "false" and
  // run the separate worker with `npm run worker` instead.
  redisUrl: process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379",
  scanWorkerInProcess: process.env.SCAN_WORKER_IN_PROCESS !== "false",
  scanWorkerConcurrency: Number(process.env.SCAN_WORKER_CONCURRENCY || 2),
  isProduction: process.env.NODE_ENV === "production",
};
