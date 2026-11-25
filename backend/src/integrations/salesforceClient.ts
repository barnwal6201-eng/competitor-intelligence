// Phase 10: a thin Salesforce client — plain fetch, no SDK (same
// approach as the Phase 6 OpenAI client and the Notion client). The
// login host is overridable via SALESFORCE_LOGIN_URL so tests can point
// it at a local mock server; in production it is login.salesforce.com
// (or test.salesforce.com for a sandbox).
//
// OAuth 2.0 web-server flow (needs a Connected App in a Salesforce org
// with the callback URL allow-listed):
//   authorize -> {LOGIN_URL}/services/oauth2/authorize
//   code exchange -> POST {LOGIN_URL}/services/oauth2/token
//   refresh -> POST {LOGIN_URL}/services/oauth2/token (grant_type=refresh_token)
// API -> POST {instance_url}/services/data/v59.0/sobjects/Task
//
// The instance URL comes back in the token response — it is stored on
// the Integration, never hard-coded.

const API_VERSION = "v59.0";
const REQUEST_TIMEOUT_MS = 30_000;

export class SalesforceError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function getSalesforceLoginUrl(): string {
  return (process.env.SALESFORCE_LOGIN_URL?.trim() || "https://login.salesforce.com").replace(/\/$/, "");
}

export function salesforceConfigured(): boolean {
  return !!(
    process.env.SALESFORCE_CLIENT_ID?.trim() && process.env.SALESFORCE_CLIENT_SECRET?.trim()
  );
}

export function getSalesforceRedirectUri(): string {
  return (
    process.env.SALESFORCE_REDIRECT_URI?.trim() ||
    "http://localhost:5000/api/integrations/salesforce/callback"
  );
}

export function buildSalesforceAuthorizeUrl(state: string): string {
  const url = new URL(`${getSalesforceLoginUrl()}/services/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.SALESFORCE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", getSalesforceRedirectUri());
  // api = REST API access; refresh_token = stay connected without
  // re-signing in every time the access token expires.
  url.searchParams.set("scope", "api refresh_token");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface SalesforceTokenResult {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  externalAccountId?: string;
  // Seconds until the access token expires (Salesforce default ~2h).
  expiresInSeconds?: number;
}

async function postToken(
  params: Record<string, string>,
  fetchFn: typeof fetch
): Promise<SalesforceTokenResult> {
  const res = await fetchWithTimeout(fetchFn, `${getSalesforceLoginUrl()}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string" || typeof data.instance_url !== "string") {
    throw new SalesforceError(
      `Salesforce refused the sign-in (HTTP ${res.status}) — check the Connected App's client id/secret and that the callback URL is allow-listed there`,
      502
    );
  }
  // The `id` URL ends with the org id / user id:
  // https://login.salesforce.com/id/00D.../005...
  const idUrl = typeof data.id === "string" ? data.id : "";
  const externalAccountId = idUrl.split("/").filter(Boolean).slice(-2, -1)[0];
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    instanceUrl: (data.instance_url as string).replace(/\/$/, ""),
    externalAccountId,
    expiresInSeconds:
      typeof data.expires_in === "number" ? data.expires_in : undefined,
  };
}

export async function exchangeSalesforceCode(
  code: string,
  fetchFn: typeof fetch = fetch
): Promise<SalesforceTokenResult> {
  if (!salesforceConfigured()) {
    throw new SalesforceError(
      "Salesforce is not configured — add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to backend/.env (create a Connected App in Setup → App Manager) and restart the backend",
      503
    );
  }
  return postToken(
    {
      grant_type: "authorization_code",
      code,
      client_id: process.env.SALESFORCE_CLIENT_ID!.trim(),
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!.trim(),
      redirect_uri: getSalesforceRedirectUri(),
    },
    fetchFn
  );
}

export async function refreshSalesforceToken(
  refreshToken: string,
  fetchFn: typeof fetch = fetch
): Promise<SalesforceTokenResult> {
  return postToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.SALESFORCE_CLIENT_ID!.trim(),
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!.trim(),
    },
    fetchFn
  );
}

export interface SalesforceTaskResult {
  id: string;
}

export async function createSalesforceTask(
  instanceUrl: string,
  accessToken: string,
  task: { subject: string; description: string },
  fetchFn: typeof fetch = fetch
): Promise<SalesforceTaskResult> {
  const res = await fetchWithTimeout(
    fetchFn,
    `${instanceUrl.replace(/\/$/, "")}/services/data/${API_VERSION}/sobjects/Task`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        Subject: task.subject,
        Description: task.description,
        Status: "Completed",
        Priority: "Normal",
      }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.id !== "string") {
    const detail = Array.isArray(data)
      ? ""
      : typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `HTTP ${res.status}`;
    throw new SalesforceError(
      `Salesforce could not create the task (${detail}) — the connection may have expired; disconnect and reconnect Salesforce`,
      502
    );
  }
  return { id: data.id };
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SalesforceError("Salesforce took too long to respond — try again", 502);
    }
    throw new SalesforceError("Could not reach Salesforce — check your network and try again", 502);
  } finally {
    clearTimeout(timeout);
  }
}
