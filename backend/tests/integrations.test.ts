// Area 10 — integrations: mock Notion + Salesforce OAuth and pushes.
import mongoose from "mongoose";
import { Integration } from "../src/models/Integration";
import { decryptToken } from "../src/integrations/crypto";
import { check, Client, eq, expectStatus, startBackend, stopBackend, tally, TEST_DB_URI, waitForHealth, type SuiteCtx, type Tally } from "./helpers";

function stateFromLocation(location: string | undefined): string {
  const u = new URL(location ?? "", "http://127.0.0.1");
  return u.searchParams.get("state") ?? "";
}

export async function run(ctx: SuiteCtx, mockNotion: any, mockSalesforce: any): Promise<Tally> {
  const t = tally("integrations");
  const { A, B } = ctx;
  const compId: string = ctx.state.scanCompId;
  const changeId: string = ctx.state.firstChangeId;

  // ---- pre-connection state ----
  const list0 = await A.get("/api/integrations");
  expectStatus(t, "integrations list returns 200", list0, 200);
  check(t, "both providers start disconnected", (list0.json?.integrations ?? []).every((i: any) => i.connected === false), JSON.stringify(list0.json));

  // 401 without auth on authorize + list.
  const anon = new Client(ctx.baseUrl);
  const unauthAuth = await anon.get("/api/integrations/notion/authorize");
  expectStatus(t, "authorize without auth returns 401", unauthAuth, 401);
  const unauthList = await anon.get("/api/integrations");
  expectStatus(t, "integrations list without auth returns 401", unauthList, 401);

  // Pushes before connecting: resource exists, so the failure is "not
  // connected" (400) — not a leak about the resource.
  const prePush = await A.post(`/api/integrations/notion/push/battlecard/${compId}`, { parentPageId: "parent-123" });
  ctx.expensiveA++;
  expectStatus(t, "Notion push before connecting returns 400", prePush, 400);

  // Callback with bad state → redirect ?error=bad-state.
  const badState = await A.get("/api/integrations/notion/callback?code=x&state=garbage", { followRedirect: false });
  check(t, "callback with bad state redirects to ?error=bad-state", badState.status === 302 && String(badState.headers.get("location") ?? "").includes("error=bad-state"), `status=${badState.status} location=${badState.headers.get("location")}`);
  const noCode = await A.get("/api/integrations/notion/callback", { followRedirect: false });
  check(t, "callback without code/state redirects to ?error=notion-denied", noCode.status === 302 && String(noCode.headers.get("location") ?? "").includes("error=notion-denied"), `status=${noCode.status} location=${noCode.headers.get("location")}`);

  // ---- Notion OAuth ----
  const authN = await A.get("/api/integrations/notion/authorize", { followRedirect: false });
  check(t, "Notion authorize redirects (302)", authN.status === 302, `status=${authN.status}`);
  const notionLoc = String(authN.headers.get("location") ?? "");
  check(t, "Notion authorize points at the mock API", notionLoc.startsWith(`http://127.0.0.1:${ctx.mockNotionPort}/v1/oauth/authorize`), notionLoc);
  const notionState = stateFromLocation(notionLoc);
  check(t, "Notion authorize carries a state token", notionState.length > 10, notionLoc);
  const notionExchangesBefore = mockNotion.tokenExchanges;
  const cbN = await A.get(`/api/integrations/notion/callback?code=test-code&state=${encodeURIComponent(notionState)}`, { followRedirect: false });
  check(t, "Notion callback redirects to the frontend", cbN.status === 302 && String(cbN.headers.get("location") ?? "").includes("?connected=notion"), `status=${cbN.status} location=${cbN.headers.get("location")}`);
  check(t, "Notion callback exchanged the code once", mockNotion.tokenExchanges === notionExchangesBefore + 1, `exchanges=${mockNotion.tokenExchanges}`);

  const listN = await A.get("/api/integrations");
  const notionRow = (listN.json?.integrations ?? []).find((i: any) => i.provider === "notion");
  check(t, "Notion shows connected after OAuth", notionRow?.connected === true, JSON.stringify(notionRow));
  check(t, "Notion list never exposes a token", !JSON.stringify(listN.json).includes("mock-notion-token-abc"));

  // Stored token is encrypted and decrypts back to the mock token.
  const storedN = await Integration.findOne({ organizationId: new mongoose.Types.ObjectId(ctx.orgA), provider: "notion" }).lean();
  check(t, "Notion token is stored (not null)", typeof storedN?.accessTokenEncrypted === "string" && storedN.accessTokenEncrypted.length > 0);
  check(t, "stored Notion token is NOT the plain token", storedN?.accessTokenEncrypted !== "mock-notion-token-abc");
  check(t, "stored Notion token decrypts back to the mock token", decryptToken(storedN!.accessTokenEncrypted) === "mock-notion-token-abc");

  // ---- Notion pushes ----
  const pagesBefore = mockNotion.pages.length;
  const pushNB = await A.post(`/api/integrations/notion/push/battlecard/${compId}`, { parentPageId: "parent-123" });
  ctx.expensiveA++;
  expectStatus(t, "Notion battlecard push returns 201", pushNB, 201);
  check(t, "Notion received exactly one new page", mockNotion.pages.length === pagesBefore + 1, `pages=${mockNotion.pages.length}`);
  const notionPage = mockNotion.pages[mockNotion.pages.length - 1];
  check(t, "Notion page is under the given parent", notionPage?.parent?.page_id === "parent-123", JSON.stringify(notionPage?.parent));
  check(t, "Notion page carries the pricing plans", JSON.stringify(notionPage).includes("Pro"), JSON.stringify(notionPage).slice(0, 500));
  check(t, "Notion page title names the competitor", JSON.stringify(notionPage?.properties ?? {}).includes("Mock Rival"), JSON.stringify(notionPage?.properties));

  const pushNC = await A.post(`/api/integrations/notion/push/change/${changeId}`, {});
  ctx.expensiveA++;
  expectStatus(t, "Notion change push returns 201", pushNC, 201);
  check(t, "Notion received the change page too", mockNotion.pages.length === pagesBefore + 2, `pages=${mockNotion.pages.length}`);

  // Cross-org: B sees nothing connected and gets 404 on A's resources.
  const listB = await B.get("/api/integrations");
  check(t, "org B sees Notion disconnected", (listB.json?.integrations ?? []).find((i: any) => i.provider === "notion")?.connected === false);
  const crossPush = await B.post(`/api/integrations/notion/push/battlecard/${compId}`, { parentPageId: "parent-123" });
  expectStatus(t, "cross-org Notion push returns 404", crossPush, 404);

  // ---- Salesforce OAuth ----
  const authS = await A.get("/api/integrations/salesforce/authorize", { followRedirect: false });
  check(t, "Salesforce authorize redirects (302)", authS.status === 302, `status=${authS.status}`);
  const sfLoc = String(authS.headers.get("location") ?? "");
  check(t, "Salesforce authorize points at the mock login host", sfLoc.startsWith(`http://127.0.0.1:${ctx.mockSalesforcePort}/services/oauth2/authorize`), sfLoc);
  const sfState = stateFromLocation(sfLoc);
  const sfTokensBefore = mockSalesforce.tokenRequests.length;
  const cbS = await A.get(`/api/integrations/salesforce/callback?code=test-code&state=${encodeURIComponent(sfState)}`, { followRedirect: false });
  check(t, "Salesforce callback redirects to the frontend", cbS.status === 302 && String(cbS.headers.get("location") ?? "").includes("?connected=salesforce"), `status=${cbS.status} location=${cbS.headers.get("location")}`);
  check(t, "Salesforce callback exchanged the code once", mockSalesforce.tokenRequests.length === sfTokensBefore + 1, `tokens=${mockSalesforce.tokenRequests.length}`);
  check(t, "Salesforce code exchange used authorization_code", mockSalesforce.tokenRequests[mockSalesforce.tokenRequests.length - 1]?.grant_type === "authorization_code");

  const storedS = await Integration.findOne({ organizationId: new mongoose.Types.ObjectId(ctx.orgA), provider: "salesforce" }).lean();
  check(t, "stored Salesforce token decrypts back", decryptToken(storedS!.accessTokenEncrypted) === "mock-sf-token-v1");
  check(t, "Salesforce instance URL points at the mock", storedS?.instanceUrl === `http://127.0.0.1:${ctx.mockSalesforcePort}`, String(storedS?.instanceUrl));

  // ---- Salesforce pushes ----
  const tasksBefore = mockSalesforce.tasks.length;
  const pushSB = await A.post(`/api/integrations/salesforce/push/battlecard/${compId}`, {});
  ctx.expensiveA++;
  expectStatus(t, "Salesforce battlecard push returns 201", pushSB, 201);
  check(t, "Salesforce received exactly one new Task", mockSalesforce.tasks.length === tasksBefore + 1, `tasks=${mockSalesforce.tasks.length}`);
  const sfTask = mockSalesforce.tasks[mockSalesforce.tasks.length - 1];
  check(t, "Salesforce Task subject names the battlecard", sfTask?.subject?.includes("Battlecard") && sfTask.subject.includes("Mock Rival"), sfTask?.subject);
  check(t, "Salesforce Task description carries pricing", sfTask?.description?.includes("Pro"), (sfTask?.description ?? "").slice(0, 300));
  check(t, "Salesforce Task used the v1 access token", sfTask?.auth === "Bearer mock-sf-token-v1", sfTask?.auth);

  // Forced expiry → proactive refresh, then the push uses the new token.
  await Integration.updateOne(
    { organizationId: new mongoose.Types.ObjectId(ctx.orgA), provider: "salesforce" },
    { $set: { expiresAt: new Date(Date.now() - 60_000) } }
  );
  const refreshBefore = mockSalesforce.tokenRequests.filter((r: any) => r.grant_type === "refresh_token").length;
  const pushSC = await A.post(`/api/integrations/salesforce/push/change/${changeId}`, {});
  ctx.expensiveA++;
  expectStatus(t, "Salesforce change push after expiry returns 201", pushSC, 201);
  check(t, "expired token was refreshed", mockSalesforce.tokenRequests.filter((r: any) => r.grant_type === "refresh_token").length === refreshBefore + 1);
  const sfTask2 = mockSalesforce.tasks[mockSalesforce.tasks.length - 1];
  check(t, "post-refresh Task used the refreshed token", sfTask2?.auth === "Bearer mock-sf-token-v2", sfTask2?.auth);
  check(t, "post-refresh Task subject names the change", sfTask2?.subject?.includes("Competitor change"), sfTask2?.subject);
  const storedS2 = await Integration.findOne({ organizationId: new mongoose.Types.ObjectId(ctx.orgA), provider: "salesforce" }).lean();
  check(t, "refreshed token is stored encrypted", decryptToken(storedS2!.accessTokenEncrypted) === "mock-sf-token-v2");

  // Cross-org Salesforce push → 404; unauthenticated push → 401.
  const crossSf = await B.post(`/api/integrations/salesforce/push/battlecard/${compId}`, {});
  expectStatus(t, "cross-org Salesforce push returns 404", crossSf, 404);
  const unauthPush = await anon.post(`/api/integrations/salesforce/push/battlecard/${compId}`, {});
  expectStatus(t, "Salesforce push without auth returns 401", unauthPush, 401);

  // Disconnect blocks further pushes.
  const discN = await A.post("/api/integrations/notion/disconnect");
  expectStatus(t, "Notion disconnect returns 200", discN, 200);
  const afterDisc = await A.post(`/api/integrations/notion/push/battlecard/${compId}`, { parentPageId: "parent-123" });
  ctx.expensiveA++;
  expectStatus(t, "Notion push after disconnect returns 400", afterDisc, 400);
  const discS = await A.post("/api/integrations/salesforce/disconnect");
  expectStatus(t, "Salesforce disconnect returns 200", discS, 200);
  const afterDiscS = await A.post(`/api/integrations/salesforce/push/battlecard/${compId}`, {});
  ctx.expensiveA++;
  expectStatus(t, "Salesforce push after disconnect returns 400", afterDiscS, 400);
  const gone = await Integration.findOne({ organizationId: new mongoose.Types.ObjectId(ctx.orgA), provider: "notion" }).lean();
  check(t, "disconnect removed the Notion row", gone === null);

  // ---- 503s: no encryption key, and unconfigured provider ----
  // Spawn 1: encryption key unset → authorize refuses before anything else.
  const auxPort = ctx.mode === "no-redis" ? 5196 : 5195;
  const aux1 = startBackend({
    port: auxPort,
    logTag: `int503a-${ctx.mode}`,
    env: {
      PORT: String(auxPort),
      NODE_ENV: "development",
      MONGODB_URI: TEST_DB_URI,
      JWT_SECRET: "test-secret-123",
      FRONTEND_URL: "http://localhost:3000",
      REDIS_URL: "redis://127.0.0.1:6390",
      SCAN_WORKER_IN_PROCESS: "true",
      INTEGRATION_ENCRYPTION_KEY: "",
      NOTION_CLIENT_ID: "test-notion-id",
      NOTION_CLIENT_SECRET: "test-notion-secret",
      SALESFORCE_CLIENT_ID: "test-sf-id",
      SALESFORCE_CLIENT_SECRET: "test-sf-secret",
    },
  });
  try {
    await waitForHealth(aux1.baseUrl);
    const auxClient = new Client(aux1.baseUrl);
    auxClient.cookie = A.cookie;
    const r1 = await auxClient.get("/api/integrations/notion/authorize");
    expectStatus(t, "authorize without an encryption key returns 503", r1, 503);
  } finally {
    await stopBackend(aux1);
  }
  // Spawn 2: key set, provider creds unset → "not configured" 503.
  const aux2 = startBackend({
    port: auxPort,
    logTag: `int503b-${ctx.mode}`,
    env: {
      PORT: String(auxPort),
      NODE_ENV: "development",
      MONGODB_URI: TEST_DB_URI,
      JWT_SECRET: "test-secret-123",
      FRONTEND_URL: "http://localhost:3000",
      REDIS_URL: "redis://127.0.0.1:6390",
      SCAN_WORKER_IN_PROCESS: "true",
      INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
      NOTION_CLIENT_ID: "",
      NOTION_CLIENT_SECRET: "",
      SALESFORCE_CLIENT_ID: "",
      SALESFORCE_CLIENT_SECRET: "",
    },
  });
  try {
    await waitForHealth(aux2.baseUrl);
    const auxClient = new Client(aux2.baseUrl);
    auxClient.cookie = A.cookie;
    const r2 = await auxClient.get("/api/integrations/notion/authorize");
    expectStatus(t, "authorize with Notion unconfigured returns 503", r2, 503);
    const r3 = await auxClient.get("/api/integrations/salesforce/authorize");
    expectStatus(t, "authorize with Salesforce unconfigured returns 503", r3, 503);
  } finally {
    await stopBackend(aux2);
  }

  return t;
}
