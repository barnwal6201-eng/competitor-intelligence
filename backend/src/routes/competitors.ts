import { Router } from "express";
import {
  listCompetitors,
  getCompetitor,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
} from "../controllers/competitorController";
import { requireAuth } from "../middleware/auth";
import { triggerScan, listSnapshots } from "../controllers/scanController";
import { listCompetitorChanges } from "../controllers/changeController";

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
router.post("/:id/scan", triggerScan);
router.get("/:id/snapshots", listSnapshots);

// Phase 5: detected changes for one competitor.
router.get("/:id/changes", listCompetitorChanges);

export default router;
