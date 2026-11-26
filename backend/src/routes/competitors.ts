import { Router } from "express";
import {
  listCompetitors,
  getCompetitor,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
} from "../controllers/competitorController";
import { requireAuth } from "../middleware/auth";
import { expensiveLimiter } from "../middleware/rateLimits";
import { triggerScan, listSnapshots, listScanJobs } from "../controllers/scanController";
import { listCompetitorChanges } from "../controllers/changeController";
import { analyzeCompetitor, listAnalyses, getAnalysis } from "../controllers/analysisController";
import {
  generateBattlecard,
  regenerateBattlecard,
  updateBattlecard,
  getBattlecard,
  listBattlecardVersions,
  getBattlecardVersion,
} from "../controllers/battlecardController";

const router = Router();

// Phase 3: every competitor endpoint requires a signed-in user, and every
// controller query is scoped to that user's organizationId.
router.use(requireAuth);

router.get("/", listCompetitors);
router.post("/", createCompetitor);
router.get("/:id", getCompetitor);
router.patch("/:id", updateCompetitor);
router.delete("/:id", deleteCompetitor);

// Phase 4: manual scan trigger and snapshot history for one competitor.
// Phase 9: POST /scan now enqueues a background job (202) instead of
// scraping in the request; GET /scan-jobs lists its job history.
// Phase 11: scans are rate-limited per user — each one scrapes the web.
router.post("/:id/scan", expensiveLimiter, triggerScan);
router.get("/:id/scan-jobs", listScanJobs);
router.get("/:id/snapshots", listSnapshots);

// Phase 5: detected changes for one competitor.
router.get("/:id/changes", listCompetitorChanges);

// Phase 6: AI analysis of the detected changes (Groq, structured JSON).
// Phase 11: rate-limited per user — each run calls the AI API.
router.post("/:id/analyze", expensiveLimiter, analyzeCompetitor);
router.get("/:id/analyses", listAnalyses);
router.get("/:id/analyses/:analysisId", getAnalysis);

// Phase 7: battlecards — generate, regenerate, edit, read, versions.
router.post("/:id/battlecard/generate", generateBattlecard);
router.post("/:id/battlecard/regenerate", regenerateBattlecard);
router.put("/:id/battlecard", updateBattlecard);
router.get("/:id/battlecard", getBattlecard);
router.get("/:id/battlecard/versions", listBattlecardVersions);
router.get("/:id/battlecard/versions/:version", getBattlecardVersion);

export default router;
