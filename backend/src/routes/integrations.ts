// Phase 10: integrations routes. OAuth callbacks are public (the
// provider redirects the browser here after sign-in); the signed `state`
// JWT proves which workspace the flow belongs to. Everything else needs
// requireAuth, and every row is org-scoped in the controller.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { expensiveLimiter } from "../middleware/rateLimits";
import {
  listIntegrations,
  authorizeIntegration,
  oauthCallback,
  disconnectIntegration,
  pushBattlecardToNotion,
  pushChangeToNotion,
  pushBattlecardToSalesforce,
  pushChangeToSalesforce,
} from "../controllers/integrationController";

const router = Router();

router.get("/", requireAuth, listIntegrations);
router.get("/:provider/authorize", requireAuth, authorizeIntegration);
router.get("/:provider/callback", oauthCallback);
router.post("/:provider/disconnect", requireAuth, disconnectIntegration);

// Phase 11: pushes are rate-limited per user — each one calls an
// external API (Notion / Salesforce).
router.post("/notion/push/battlecard/:competitorId", requireAuth, expensiveLimiter, pushBattlecardToNotion);
router.post("/notion/push/change/:changeId", requireAuth, expensiveLimiter, pushChangeToNotion);
router.post("/salesforce/push/battlecard/:competitorId", requireAuth, expensiveLimiter, pushBattlecardToSalesforce);
router.post("/salesforce/push/change/:changeId", requireAuth, expensiveLimiter, pushChangeToSalesforce);

export default router;
