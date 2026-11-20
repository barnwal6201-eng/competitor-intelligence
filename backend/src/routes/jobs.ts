import { Router } from "express";
import { getDbStatus } from "../config/db";
import { checkRedis } from "../config/redis";

const router = Router();

// GET /api/health — the only endpoint in Phase 1.
// Returns real status only: no fake competitors, metrics or analytics.
// Phase 9 adds the Redis status, checked live with a ping (a cached
// flag can go stale when a BullMQ connection drops and reconnects).
router.get("/", async (_req, res) => {
  const db = getDbStatus();
  const redis = await checkRedis();
  res.json({
    status: "ok",
    service: "competitor-intelligence-backend",
    timestamp: new Date().toISOString(),
    database: db.connected ? "connected" : "disconnected",
    databaseNote: db.note,
    redis: redis.connected ? "connected" : "disconnected",
    redisNote: redis.note,
  });
});

export default router;
