// Phase 10: integrations routes. OAuth callbacks are public (the
// provider redirects the browser here after sign-in); the signed `state`
// JWT proves which workspace the flow belongs to. Everything else needs
// requireAuth, and every row is org-scoped in the controller.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
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

router.post("/notion/push/battlecard/:competitorId", requireAuth, pushBattlecardToNotion);
router.post("/notion/push/change/:changeId", requireAuth, pushChangeToNotion);
router.post("/salesforce/push/battlecard/:competitorId", requireAuth, pushBattlecardToSalesforce);
router.post("/salesforce/push/change/:changeId", requireAuth, pushChangeToSalesforce);

export default router;
