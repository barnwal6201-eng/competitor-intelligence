import { resolveApiUrl } from "./apiUrl";
import type { IntegrationInfo, IntegrationPushResult } from "@/types";

// Integration API calls (Phase 10). Every call sends the httpOnly auth
// cookie. Connect is a plain browser link to the backend authorize URL —
// the provider's sign-in page, then the backend callback — so it is not
// a fetch call here.
const API_URL = resolveApiUrl();

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export function getIntegrationAuthorizeUrl(provider: "notion" | "salesforce"): string {
  return `${API_URL}/api/integrations/${provider}/authorize`;
}

// GET /api/integrations — both providers, connected or not.
export async function listIntegrations(): Promise<IntegrationInfo[]> {
  const res = await fetch(`${API_URL}/api/integrations`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ integrations: IntegrationInfo[] }>(res)).integrations;
}

// POST /api/integrations/:provider/disconnect
export async function disconnectIntegration(provider: "notion" | "salesforce"): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${provider}/disconnect`, {
    method: "POST",
    credentials: "include",
  });
  await handleResponse<{ disconnected: string }>(res);
}

// POST /api/integrations/notion/push/battlecard/:competitorId
export async function pushBattlecardToNotion(
  competitorId: string,
  parentPageId?: string
): Promise<IntegrationPushResult> {
  const res = await fetch(`${API_URL}/api/integrations/notion/push/battlecard/${competitorId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentPageId: parentPageId || undefined }),
  });
  return handleResponse<IntegrationPushResult>(res);
}

// POST /api/integrations/notion/push/change/:changeId
export async function pushChangeToNotion(
  changeId: string,
  parentPageId?: string
): Promise<IntegrationPushResult> {
  const res = await fetch(`${API_URL}/api/integrations/notion/push/change/${changeId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentPageId: parentPageId || undefined }),
  });
  return handleResponse<IntegrationPushResult>(res);
}

// POST /api/integrations/salesforce/push/battlecard/:competitorId
export async function pushBattlecardToSalesforce(
  competitorId: string
): Promise<IntegrationPushResult> {
  const res = await fetch(
    `${API_URL}/api/integrations/salesforce/push/battlecard/${competitorId}`,
    { method: "POST", credentials: "include" }
  );
  return handleResponse<IntegrationPushResult>(res);
}

// POST /api/integrations/salesforce/push/change/:changeId
export async function pushChangeToSalesforce(changeId: string): Promise<IntegrationPushResult> {
  const res = await fetch(`${API_URL}/api/integrations/salesforce/push/change/${changeId}`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<IntegrationPushResult>(res);
}
