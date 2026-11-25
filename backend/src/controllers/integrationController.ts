// Phase 10: integrations — connect Notion / Salesforce with OAuth and
// push battlecards + detected changes into them.
//
// Flow (same for both providers):
//   1. GET /api/integrations/:provider/authorize (signed in) —
//      redirects the browser to the provider's sign-in page. The `state`
//      is a 10-minute JWT holding the org, so the callback can prove the
//      request came from this workspace.
//   2. GET /api/integrations/:provider/callback?code&state (public) —
//      exchanges the code for tokens, encrypts them, stores one
//      Integration row per provider per org, then redirects to the
//      frontend Integrations page.
//   3. POST /api/integrations/:provider/push/battlecard/:competitorId
//      and .../push/change/:changeId (signed in) — sends the content to
//      the connected account. Notion creates a page; Salesforce creates
//      a Task. Nothing is ever invented here — both payloads restate the
//      battlecard / change the app already holds.
//
// Tokens are never returned by any endpoint and never logged.

import type { Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Integration, type IIntegration, type IntegrationProvider } from "../models/Integration";
import { Competitor } from "../models/Competitor";
import { Battlecard, type IBattlecard } from "../models/Battlecard";
import { Change } from "../models/Change";
import { encryptToken, decryptToken, hasEncryptionKey } from "../integrations/crypto";
import {
  buildNotionAuthorizeUrl,
  exchangeNotionCode,
  createNotionPage,
  notionConfigured,
  NotionError,
} from "../integrations/notionClient";
import {
  battlecardToNotionBlocks,
  battlecardToNotionTitle,
  changeToNotionBlocks,
  changeToNotionTitle,
} from "../integrations/notionBlocks";
import {
  buildSalesforceAuthorizeUrl,
  exchangeSalesforceCode,
  refreshSalesforceToken,
  createSalesforceTask,
  salesforceConfigured,
  SalesforceError,
} from "../integrations/salesforceClient";
import {
  battlecardToSalesforceTask,
  changeToSalesforceTask,
} from "../integrations/salesforcePayload";
import type { AuthRequest } from "../middleware/auth";

const PROVIDERS: IntegrationProvider[] = ["notion", "salesforce"];

function dbConnected(res: Response): boolean {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "Database not connected — set MONGODB_URI in backend/.env and restart the backend",
    });
    return false;
  }
  return true;
}

function orgFilter(req: AuthRequest) {
  return { organizationId: new mongoose.Types.ObjectId(req.user!.organizationId) };
}

function isProvider(value: unknown): value is IntegrationProvider {
  return value === "notion" || value === "salesforce";
}

function publicIntegration(row: IIntegration | null, provider: IntegrationProvider) {
  return {
    provider,
    connected: !!row,
    status: row?.status ?? null,
    externalAccountId: row?.externalAccountId ?? null,
    externalAccountName: row?.externalAccountName ?? null,
    configured: provider === "notion" ? notionConfigured() : salesforceConfigured(),
    lastPushAt: row?.lastPushAt ? row.lastPushAt.toISOString() : null,
    lastPushTarget: row?.lastPushTarget ?? null,
    lastPushKind: row?.lastPushKind ?? null,
    notionParentPageId: row?.settings?.notionParentPageId ?? null,
  };
}

// GET /api/integrations — both providers, connected or not, with whether
// each one is even configured in backend/.env (so the UI can show the
// setup steps instead of a dead Connect button).
export async function listIntegrations(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const rows = await Integration.find({ ...orgFilter(req) }).lean();
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    res.json({
      integrations: PROVIDERS.map((p) =>
        publicIntegration((byProvider.get(p) as unknown as IIntegration | null) ?? null, p)
      ),
    });
  } catch (err) {
    console.error("List integrations failed:", err);
    res.status(500).json({ error: "Failed to list integrations" });
  }
}

function signState(req: AuthRequest, provider: IntegrationProvider): string {
  return jwt.sign(
    { orgId: req.user!.organizationId, userId: req.user!.id, provider },
    env.jwtSecret,
    { expiresIn: "10m" }
  );
}

function verifyState(state: string): { orgId: string; userId: string; provider: string } {
  return jwt.verify(state, env.jwtSecret) as { orgId: string; userId: string; provider: string };
}

// GET /api/integrations/:provider/authorize — send the browser to the
// provider's sign-in page. Refuses early if tokens could not be stored
// (no encryption key) or the provider is not configured.
export async function authorizeIntegration(req: AuthRequest, res: Response): Promise<void> {
  try {
    const provider = req.params.provider as string;
    if (!isProvider(provider)) {
      res.status(404).json({ error: "Unknown integration" });
      return;
    }
    if (!hasEncryptionKey()) {
      res.status(503).json({
        error:
          "INTEGRATION_ENCRYPTION_KEY is not set — generate a 64-character hex key and add it to backend/.env before connecting (see backend/.env.example)",
      });
      return;
    }
    const configured = provider === "notion" ? notionConfigured() : salesforceConfigured();
    if (!configured) {
      res.status(503).json({
        error:
          provider === "notion"
            ? "Notion is not configured — add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET to backend/.env and restart the backend"
            : "Salesforce is not configured — add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to backend/.env and restart the backend",
      });
      return;
    }
    const state = signState(req, provider);
    const url =
      provider === "notion" ? buildNotionAuthorizeUrl(state) : buildSalesforceAuthorizeUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error("Authorize integration failed:", err);
    res.status(500).json({ error: "Failed to start the connection" });
  }
}

// GET /api/integrations/:provider/callback — the provider redirects here
// after sign-in. Exchanges the code, stores the encrypted tokens, then
// sends the browser back to the frontend Integrations page.
export async function oauthCallback(req: AuthRequest, res: Response): Promise<void> {
  const provider = req.params.provider as string;
  const frontend = `${env.frontendUrl}/integrations`;
  try {
    if (!isProvider(provider)) {
      res.redirect(`${frontend}?error=unknown-provider`);
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      res.redirect(`${frontend}?error=${provider}-denied`);
      return;
    }
    let decoded: { orgId: string; userId: string; provider: string };
    try {
      decoded = verifyState(state);
    } catch {
      res.redirect(`${frontend}?error=bad-state`);
      return;
    }
    if (decoded.provider !== provider || !mongoose.isValidObjectId(decoded.orgId)) {
      res.redirect(`${frontend}?error=bad-state`);
      return;
    }
    if (!dbConnected(res)) return;
    if (!hasEncryptionKey()) {
      res.redirect(`${frontend}?error=no-encryption-key`);
      return;
    }
    const orgId = new mongoose.Types.ObjectId(decoded.orgId);
    if (provider === "notion") {
      const token = await exchangeNotionCode(code);
      await Integration.findOneAndUpdate(
        { organizationId: orgId, provider },
        {
          organizationId: orgId,
          provider,
          status: "connected",
          accessTokenEncrypted: encryptToken(token.accessToken),
          refreshTokenEncrypted: null,
          expiresAt: null,
          externalAccountId: token.workspaceId ?? null,
          externalAccountName: token.workspaceName ?? null,
          instanceUrl: null,
        },
        { upsert: true, new: true }
      );
    } else {
      const token = await exchangeSalesforceCode(code);
      await Integration.findOneAndUpdate(
        { organizationId: orgId, provider },
        {
          organizationId: orgId,
          provider,
          status: "connected",
          accessTokenEncrypted: encryptToken(token.accessToken),
          refreshTokenEncrypted: token.refreshToken ? encryptToken(token.refreshToken) : null,
          expiresAt: token.expiresInSeconds
            ? new Date(Date.now() + token.expiresInSeconds * 1000)
            : null,
          externalAccountId: token.externalAccountId ?? null,
          externalAccountName: null,
          instanceUrl: token.instanceUrl,
        },
        { upsert: true, new: true }
      );
    }
    res.redirect(`${frontend}?connected=${provider}`);
  } catch (err) {
    console.error("OAuth callback failed:", err);
    if (err instanceof NotionError || err instanceof SalesforceError) {
      res.redirect(`${frontend}?error=${provider}-failed`);
      return;
    }
    res.redirect(`${frontend}?error=${provider}-failed`);
  }
}

// POST /api/integrations/:provider/disconnect — remove the stored tokens.
export async function disconnectIntegration(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const provider = req.params.provider as string;
    if (!isProvider(provider)) {
      res.status(404).json({ error: "Unknown integration" });
      return;
    }
    await Integration.deleteOne({ ...orgFilter(req), provider });
    res.json({ disconnected: provider });
  } catch (err) {
    console.error("Disconnect integration failed:", err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
}

async function loadIntegration(req: AuthRequest, provider: IntegrationProvider) {
  return Integration.findOne({ ...orgFilter(req), provider });
}

async function loadCompetitorAndBattlecard(req: AuthRequest, res: Response) {
  const competitorId = req.params.competitorId as string;
  if (!mongoose.isValidObjectId(competitorId)) {
    res.status(404).json({ error: "Competitor not found" });
    return null;
  }
  // Casts: Mongoose's .lean() typing resolves to a union with an array
  // type here; the runtime value is one document (same pattern as the
  // battlecard controller).
  const competitor = (await Competitor.findOne({ _id: competitorId, ...orgFilter(req) }).lean()) as unknown as {
    _id: unknown;
    companyName: string;
  } | null;
  if (!competitor) {
    res.status(404).json({ error: "Competitor not found" });
    return null;
  }
  const battlecard = (await Battlecard.findOne({ competitorId, ...orgFilter(req) }).lean()) as unknown as IBattlecard | null;
  if (!battlecard) {
    res.status(404).json({ error: "No battlecard yet — generate one first" });
    return null;
  }
  return { competitor, battlecard };
}

async function loadChange(req: AuthRequest, res: Response) {
  const changeId = req.params.changeId as string;
  if (!mongoose.isValidObjectId(changeId)) {
    res.status(404).json({ error: "Change not found" });
    return null;
  }
  const change = (await Change.findOne({ _id: changeId, ...orgFilter(req) }).lean()) as unknown as {
    _id: unknown;
    competitorId: unknown;
    category: string;
    significance: string;
    title: string;
    previousValue?: unknown;
    newValue?: unknown;
    sourceUrl: string;
    sourceType: string;
    detectedAt: Date;
  } | null;
  if (!change) {
    res.status(404).json({ error: "Change not found" });
    return null;
  }
  const competitor = (await Competitor.findOne({ _id: change.competitorId, ...orgFilter(req) })
    .select("companyName")
    .lean()) as unknown as { companyName: string } | null;
  return { change, competitorName: competitor?.companyName ?? "Competitor" };
}

function requireConnected(
  res: Response,
  row: IIntegration | null,
  provider: IntegrationProvider
): row is IIntegration {
  if (!row) {
    res.status(400).json({
      error:
        provider === "notion"
          ? "Notion is not connected — connect it on the Integrations page first"
          : "Salesforce is not connected — connect it on the Integrations page first",
    });
    return false;
  }
  return true;
}

async function recordPush(
  row: IIntegration,
  kind: "battlecard" | "change",
  target: string
): Promise<void> {
  row.lastPushAt = new Date();
  row.lastPushTarget = target;
  row.lastPushKind = kind;
  row.status = "connected";
  await row.save();
}

// POST /api/integrations/notion/push/battlecard/:competitorId
// Body: { parentPageId?: string } — the Notion page the battlecard goes
// under. Remembered on the integration after the first push, so it only
// needs pasting once. The parent page must be shared with the
// integration inside Notion (page … → Add connections).
export async function pushBattlecardToNotion(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const loaded = await loadCompetitorAndBattlecard(req, res);
    if (!loaded) return;
    const row = await loadIntegration(req, "notion");
    if (!requireConnected(res, row, "notion")) return;
    const parentPageId =
      (typeof req.body?.parentPageId === "string" && req.body.parentPageId.trim()) ||
      row.settings?.notionParentPageId ||
      "";
    if (!parentPageId) {
      res.status(400).json({
        error:
          "No parent page set — open the page in Notion, share it with this integration (… → Add connections), then paste its page id here (the last part of the page URL)",
      });
      return;
    }
    const title = battlecardToNotionTitle(loaded.battlecard as any, loaded.competitor.companyName);
    const page = await createNotionPage(
      decryptToken(row.accessTokenEncrypted),
      parentPageId,
      title,
      battlecardToNotionBlocks(loaded.battlecard as any, loaded.competitor.companyName)
    );
    row.settings.notionParentPageId = parentPageId;
    await recordPush(row, "battlecard", title);
    res.status(201).json({
      provider: "notion",
      kind: "battlecard",
      externalId: page.id,
      externalUrl: page.url ?? null,
      title,
    });
  } catch (err) {
    console.error("Push battlecard to Notion failed:", err);
    if (err instanceof NotionError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Failed to push the battlecard to Notion" });
  }
}

// POST /api/integrations/notion/push/change/:changeId
export async function pushChangeToNotion(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const loaded = await loadChange(req, res);
    if (!loaded) return;
    const row = await loadIntegration(req, "notion");
    if (!requireConnected(res, row, "notion")) return;
    const parentPageId =
      (typeof req.body?.parentPageId === "string" && req.body.parentPageId.trim()) ||
      row.settings?.notionParentPageId ||
      "";
    if (!parentPageId) {
      res.status(400).json({
        error:
          "No parent page set — open the page in Notion, share it with this integration (… → Add connections), then paste its page id here (the last part of the page URL)",
      });
      return;
    }
    const title = changeToNotionTitle(loaded.change as any, loaded.competitorName);
    const page = await createNotionPage(
      decryptToken(row.accessTokenEncrypted),
      parentPageId,
      title,
      changeToNotionBlocks(loaded.change as any, loaded.competitorName)
    );
    row.settings.notionParentPageId = parentPageId;
    await recordPush(row, "change", title);
    res.status(201).json({
      provider: "notion",
      kind: "change",
      externalId: page.id,
      externalUrl: page.url ?? null,
      title,
    });
  } catch (err) {
    console.error("Push change to Notion failed:", err);
    if (err instanceof NotionError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Failed to push the change to Notion" });
  }
}

// Salesforce access tokens expire (~2h). Refresh proactively when the
// stored expiry has passed; if there is no refresh token, the push fails
// with a plain message telling the user to reconnect.
async function salesforceAccess(row: IIntegration): Promise<{ accessToken: string; instanceUrl: string }> {
  if (row.expiresAt && row.expiresAt.getTime() < Date.now() && row.refreshTokenEncrypted) {
    const refreshed = await refreshSalesforceToken(decryptToken(row.refreshTokenEncrypted));
    row.accessTokenEncrypted = encryptToken(refreshed.accessToken);
    if (refreshed.refreshToken) row.refreshTokenEncrypted = encryptToken(refreshed.refreshToken);
    if (refreshed.expiresInSeconds) {
      row.expiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1000);
    }
    if (refreshed.instanceUrl) row.instanceUrl = refreshed.instanceUrl;
    await row.save();
  }
  if (!row.instanceUrl) {
    throw new SalesforceError(
      "Salesforce connection is missing its instance URL — disconnect and reconnect Salesforce",
      500
    );
  }
  return { accessToken: decryptToken(row.accessTokenEncrypted), instanceUrl: row.instanceUrl };
}

async function createTaskWithRefresh(
  row: IIntegration,
  task: { subject: string; description: string }
): Promise<{ id: string }> {
  const access = await salesforceAccess(row);
  try {
    return await createSalesforceTask(access.instanceUrl, access.accessToken, task);
  } catch (err) {
    // The token may have expired server-side even though our stored
    // expiry had not passed — refresh once and retry before giving up.
    if (err instanceof SalesforceError && row.refreshTokenEncrypted) {
      const refreshed = await refreshSalesforceToken(decryptToken(row.refreshTokenEncrypted));
      row.accessTokenEncrypted = encryptToken(refreshed.accessToken);
      if (refreshed.refreshToken) row.refreshTokenEncrypted = encryptToken(refreshed.refreshToken);
      if (refreshed.expiresInSeconds) {
        row.expiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1000);
      }
      if (refreshed.instanceUrl) row.instanceUrl = refreshed.instanceUrl;
      await row.save();
      return await createSalesforceTask(refreshed.instanceUrl, refreshed.accessToken, task);
    }
    throw err;
  }
}

// POST /api/integrations/salesforce/push/battlecard/:competitorId
export async function pushBattlecardToSalesforce(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const loaded = await loadCompetitorAndBattlecard(req, res);
    if (!loaded) return;
    const row = await loadIntegration(req, "salesforce");
    if (!requireConnected(res, row, "salesforce")) return;
    const task = battlecardToSalesforceTask(loaded.battlecard as any, loaded.competitor.companyName);
    const created = await createTaskWithRefresh(row, task);
    await recordPush(row, "battlecard", task.subject);
    res.status(201).json({
      provider: "salesforce",
      kind: "battlecard",
      externalId: created.id,
      externalUrl: null,
      title: task.subject,
    });
  } catch (err) {
    console.error("Push battlecard to Salesforce failed:", err);
    if (err instanceof SalesforceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Failed to push the battlecard to Salesforce" });
  }
}

// POST /api/integrations/salesforce/push/change/:changeId
export async function pushChangeToSalesforce(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const loaded = await loadChange(req, res);
    if (!loaded) return;
    const row = await loadIntegration(req, "salesforce");
    if (!requireConnected(res, row, "salesforce")) return;
    const task = changeToSalesforceTask(loaded.change as any, loaded.competitorName);
    const created = await createTaskWithRefresh(row, task);
    await recordPush(row, "change", task.subject);
    res.status(201).json({
      provider: "salesforce",
      kind: "change",
      externalId: created.id,
      externalUrl: null,
      title: task.subject,
    });
  } catch (err) {
    console.error("Push change to Salesforce failed:", err);
    if (err instanceof SalesforceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Failed to push the change to Salesforce" });
  }
}
