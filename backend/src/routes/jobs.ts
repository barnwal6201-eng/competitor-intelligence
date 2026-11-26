import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getScanJob, listScanJobs } from "../controllers/jobController";

const router = Router();

// Phase 9: scan-job status. Every endpoint requires a signed-in user
// and is scoped to that user's organization.
router.use(requireAuth);

router.get("/", listScanJobs);
router.get("/:jobId", getScanJob);

export default router;
