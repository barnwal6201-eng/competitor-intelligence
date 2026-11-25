// Phase 10: a thin Notion client — plain fetch, no extra SDK dependency
// (same approach as the Phase 6 OpenAI client). The base URL is
// overridable via NOTION_API_BASE_URL so tests can point it at a local
// mock server instead of api.notion.com; in production it is always the
// real Notion API. Every call takes an injectable fetch so tests can
// also stub transport directly.
//
// Notion OAuth (public integration, owner=user):
//   authorize URL -> https://api.notion.com/v1/oauth/authorize
//   code exchange -> POST /v1/oauth/token (Basic auth client_id:secret)
// Page create -> POST /v1/pages with Notion-Version: 2022-06-28.

const NOTION_VERSION = "2022-06-28";
const REQUEST_TIMEOUT_MS = 30_000;

export class NotionError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function getNotionApiBase(): string {
  return (process.env.NOTION_API_BASE_URL?.trim() || "https://api.notion.com").replace(/\/$/, "");
}

export function getNotionAuthBase(): string {
  // The OAuth authorize/token endpoints live on the same host as the API.
  return getNotionApiBase();
}

export function notionConfigured(): boolean {
  return !!(process.env.NOTION_CLIENT_ID?.trim() && process.env.NOTION_CLIENT_SECRET?.trim());
}

export function getNotionRedirectUri(): string {
  return (
    process.env.NOTION_REDIRECT_URI?.trim() ||
    "http://localhost:5000/api/integrations/notion/callback"
  );
}

export function buildNotionAuthorizeUrl(state: string): string {
  const url = new URL(`${getNotionAuthBase()}/v1/oauth/authorize`);
  url.searchParams.set("client_id", process.env.NOTION_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", getNotionRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface NotionTokenResult {
  accessToken: string;
  workspaceId?: string;
  workspaceName?: string;
  botId?: string;
}

export async function exchangeNotionCode(
  code: string,
  fetchFn: typeof fetch = fetch
): Promise<NotionTokenResult> {
  const clientId = process.env.NOTION_CLIENT_ID?.trim();
  const clientSecret = process.env.NOTION_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new NotionError(
      "Notion is not configured — add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET to backend/.env (create a public integration at https://www.notion.so/my-integrations) and restart the backend",
      503
    );
  }
  const res = await fetchWithTimeout(
    fetchFn,
    `${getNotionAuthBase()}/v1/oauth/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: getNotionRedirectUri(),
      }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    throw new NotionError(
      `Notion refused the sign-in (HTTP ${res.status}) — try connecting again, and check the integration's redirect URI matches NOTION_REDIRECT_URI`,
      502
    );
  }
  return {
    accessToken: data.access_token,
    workspaceId: typeof data.workspace_id === "string" ? data.workspace_id : undefined,
    workspaceName: typeof data.workspace_name === "string" ? data.workspace_name : undefined,
    botId: typeof data.bot_id === "string" ? data.bot_id : undefined,
  };
}

export interface NotionPageResult {
  id: string;
  url?: string;
}

export async function createNotionPage(
  accessToken: string,
  parentPageId: string,
  title: string,
  children: unknown[],
  fetchFn: typeof fetch = fetch
): Promise<NotionPageResult> {
  const res = await fetchWithTimeout(fetchFn, `${getNotionApiBase()}/v1/pages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      properties: {
        title: [{ type: "text", text: { content: title.slice(0, 200) } }],
      },
      children,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.id !== "string") {
    const detail =
      typeof data.message === "string" ? data.message : `HTTP ${res.status}`;
    throw new NotionError(
      `Notion could not create the page (${detail}) — make sure the parent page is shared with the integration in Notion (… → Add connections) and the page id is right`,
      502
    );
  }
  return { id: data.id, url: typeof data.url === "string" ? data.url : undefined };
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
      throw new NotionError("Notion took too long to respond — try again", 502);
    }
    throw new NotionError("Could not reach Notion — check your network and try again", 502);
  } finally {
    clearTimeout(timeout);
  }
}
