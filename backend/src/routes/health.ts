import { Router } from "express";
import { getDbStatus } from "../config/db";

const router = Router();

// GET /api/health — the only endpoint in Phase 1.
// Returns real status only: no fake competitors, metrics or analytics.
router.get("/", (_req, res) => {
  const db = getDbStatus();
  res.json({
    status: "ok",
    service: "competitor-intelligence-backend",
    timestamp: new Date().toISOString(),
    database: db.connected ? "connected" : "disconnected",
    databaseNote: db.note,
  });
});

export default router;
