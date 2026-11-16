import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getDashboardOverview } from "../controllers/dashboardController";

const router = Router();

// Phase 8: the dashboard overview — real counts and aggregations over the
// signed-in user's organization. Every endpoint requires a signed-in user,
// and every query is scoped to that user's organizationId.
router.use(requireAuth);

router.get("/overview", getDashboardOverview);

export default router;
