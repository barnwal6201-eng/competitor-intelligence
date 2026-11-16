import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listBattlecards } from "../controllers/battlecardController";

const router = Router();

// Phase 7: the organization-wide battlecard list (for the /battlecards
// page). Every endpoint requires a signed-in user, and every query is
// scoped to that user's organizationId.
router.use(requireAuth);

router.get("/", listBattlecards);

export default router;
