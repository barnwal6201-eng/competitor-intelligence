import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listFeed } from "../controllers/changeController";

const router = Router();

// Phase 5: the intelligence feed — detected changes across the whole
// organization. Every endpoint requires a signed-in user, and every query
// is scoped to that user's organizationId.
router.use(requireAuth);

router.get("/", listFeed);

export default router;
