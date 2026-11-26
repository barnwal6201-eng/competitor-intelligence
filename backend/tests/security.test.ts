// Area 11 — security: cross-org 404s, unauthenticated 401s, headers,
// oversized bodies, production cookie flags, missing-secret refusal,
// and the two rate-limit tests (run LAST — they exhaust the budgets).
import { spawn } from "node:child_process";
import {
  BACKEND_DIR,
  check,
  Client,
  eq,
  expectStatus,
  register,
  sleep,
  startBackend,
  stopBackend,
  tally,
  TEST_DB_URI,
  waitForExit,
  waitForHealth,
  type SuiteCtx,
  type Tally,
} from "./helpers";

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("security");
  const { A, B } = ctx;
  const compId: string = ctx.state.scanCompId;
  const analysisId: string = ctx.state.analysisId;
  const changeId: string = ctx.state.firstChangeId;
  const scanJobId: string | undefined = ctx.state.scanJobId;

  // ---- cross-org 404s across every resource type ----
  const cross: [string, string, string][] = [
    ["competitor", "GET", `/api/competitors/${compId}`],
    ["snapshots", "GET", `/api/competitors/${compId}/snapshots`],
    ["changes", "GET", `/api/competitors/${compId}/changes`],
    ["analyses list", "GET", `/api/competitors/${compId}/analyses`],
    ["single analysis", "GET", `/api/competitors/${compId}/analyses/${analysisId}`],
    ["battlecard", "GET", `/api/competitors/${compId}/battlecard`],
    ["battlecard versions", "GET", `/api/competitors/${compId}/battlecard/versions`],
    ["per-competitor scan jobs", "GET", `/api/competitors/${compId}/scan-jobs`],
  ];
  for (const [label, method, path] of cross) {
    const res = method === "GET" ? await B.get(path) : await B.post(path);
    expectStatus(t, `cross-org ${label} returns 404`, res, 404);
  }
  if (scanJobId) {
    const crossJob = await B.get(`/api/jobs/${scanJobId}`);
    expectStatus(t, "cross-org scan job returns 404", crossJob, 404);
  } else {
    check(t, "scanJobId was recorded for the cross-org job check", false, "jobs area did not store a scanJobId");
  }
  const crossSfChange = await B.post(`/api/integrations/salesforce/push/change/${changeId}`, {});
  expectStatus(t, "cross-org Salesforce change push returns 404", crossSfChange, 404);

  // ---- unauthenticated 401s on every protected route ----
  const anon = new Client(ctx.baseUrl);
  const unauth: [string, string][] = [
    ["GET /api/competitors", "GET"],
    ["GET /api/competitors/:id", "GET"],
    ["GET /api/competitors/:id/snapshots", "GET"],
    ["GET /api/competitors/:id/changes", "GET"],
    ["GET /api/changes", "GET"],
    ["GET /api/dashboard/overview", "GET"],
    ["GET /api/battlecards", "GET"],
    ["GET /api/jobs", "GET"],
    ["GET /api/integrations", "GET"],
    ["GET /api/auth/me", "GET"],
  ];
  const unauthPaths: Record<string, string> = {
    "GET /api/competitors": "/api/competitors",
    "GET /api/competitors/:id": `/api/competitors/${compId}`,
    "GET /api/competitors/:id/snapshots": `/api/competitors/${compId}/snapshots`,
    "GET /api/competitors/:id/changes": `/api/competitors/${compId}/changes`,
    "GET /api/changes": "/api/changes",
    "GET /api/dashboard/overview": "/api/dashboard/overview",
    "GET /api/battlecards": "/api/battlecards",
    "GET /api/jobs": "/api/jobs",
    "GET /api/integrations": "/api/integrations",
    "GET /api/auth/me": "/api/auth/me",
  };
  for (const [label] of unauth) {
    const res = await anon.get(unauthPaths[label]);
    expectStatus(t, `${label} without auth returns 401`, res, 401);
  }
  const unauthScan = await anon.post(`/api/competitors/${compId}/scan`);
  expectStatus(t, "POST /scan without auth returns 401", unauthScan, 401);
  const unauthAnalyse = await anon.post(`/api/competitors/${compId}/analyze`);
  expectStatus(t, "POST /analyze without auth returns 401", unauthAnalyse, 401);

  // ---- security headers (helmet) on a public + an authed response ----
  const health = await anon.get("/api/health");
  eq(t, "X-Content-Type-Options is nosniff", health.headers.get("x-content-type-options"), "nosniff");
  check(t, "X-Frame-Options is set", typeof health.headers.get("x-frame-options") === "string", String(health.headers.get("x-frame-options")));
  check(t, "X-Powered-By is absent", health.headers.get("x-powered-by") === null, String(health.headers.get("x-powered-by")));
  const authed = await A.get("/api/competitors");
  eq(t, "authed response also carries nosniff", authed.headers.get("x-content-type-options"), "nosniff");
  check(t, "authed response has no X-Powered-By", authed.headers.get("x-powered-by") === null);

  // ---- 413 on an oversized JSON body ----
  const big = await A.post("/api/competitors", undefined, {
    rawBody: JSON.stringify({ companyName: "x".repeat(150_000), websiteUrl: "https://big.example.com" }),
  });
  expectStatus(t, "150kb JSON body returns 413", big, 413);

  // ---- production cookie flags + missing-secret refusal ----
  const prodPort = 5194;
  const prod = startBackend({
    port: prodPort,
    logTag: `prod-${ctx.mode}`,
    env: {
      PORT: String(prodPort),
      NODE_ENV: "production",
      MONGODB_URI: TEST_DB_URI,
      JWT_SECRET: "test-secret-123",
      FRONTEND_URL: "http://localhost:3000",
      REDIS_URL: "redis://127.0.0.1:6390",
      SCAN_WORKER_IN_PROCESS: "true",
    },
  });
  try {
    await waitForHealth(prod.baseUrl);
    const prodClient = new Client(prod.baseUrl);
    const reg = await register(prodClient, "Prod User", `prod-${ctx.mode}@phase11.test`, "Prod Org");
    expectStatus(t, "production backend registers 201", reg, 201);
    const cookie = reg.setCookies.find((c) => c.startsWith("token=")) ?? "";
    check(t, "production cookie is HttpOnly", /httponly/i.test(cookie), cookie);
    check(t, "production cookie is Secure", /;\s*Secure/i.test(cookie), cookie);
    check(t, "production cookie is SameSite=None", /SameSite=None/i.test(cookie), cookie);
    const me = await prodClient.get("/api/auth/me");
    expectStatus(t, "production session works for /me", me, 200);
  } finally {
    await stopBackend(prod);
  }

  // NODE_ENV=production WITHOUT JWT_SECRET → the backend refuses to start.
  const noSecretEnv: Record<string, string | undefined> = { ...process.env };
  delete noSecretEnv.JWT_SECRET;
  noSecretEnv.NODE_ENV = "production";
  noSecretEnv.PORT = "5193";
  noSecretEnv.MONGODB_URI = TEST_DB_URI;
  noSecretEnv.FRONTEND_URL = "http://localhost:3000";
  const refused = spawn("node", ["dist/server.js"], {
    cwd: BACKEND_DIR,
    env: noSecretEnv as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let refusedOut = "";
  refused.stdout?.on("data", (d: Buffer) => (refusedOut += d.toString()));
  refused.stderr?.on("data", (d: Buffer) => (refusedOut += d.toString()));
  const exitCode = await waitForExit(refused, 15000);
  if (exitCode === null) {
    try {
      refused.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
  check(t, "production without JWT_SECRET exits non-zero", exitCode !== null && exitCode !== 0, `exit=${exitCode} out=${refusedOut.slice(0, 300)}`);
  check(t, "refusal names JWT_SECRET", /JWT_SECRET/i.test(refusedOut), refusedOut.slice(0, 300));

  // ---- rate limits (LAST) ----
  // Login: 30 per 15 min per IP. The auth area already made 4 login
  // calls on this backend, so 26 of the next 40 pass and 14 hit 429.
  let login401 = 0;
  let login429 = 0;
  for (let i = 0; i < 40; i++) {
    const r = await anon.post("/api/auth/login", { email: `ratelimit-${ctx.mode}@phase11.test`, password: "WrongPass999!" });
    if (r.status === 401) login401++;
    else if (r.status === 429) login429++;
  }
  eq(t, "login rate limit: 26 of 40 bad logins get 401", login401, 26);
  eq(t, "login rate limit: 14 of 40 bad logins get 429", login429, 14);

  // Expensive: 30 per 15 min per signed-in user. Dedicated user C has
  // made no expensive calls yet; analyse with no changes is a fast 200.
  const rateComp = await ctx.C.post("/api/competitors", {
    companyName: "Rate Rival",
    websiteUrl: "https://rate.example.com",
  });
  expectStatus(t, "rate-test competitor creates 201", rateComp, 201);
  const rateCompId: string | undefined = rateComp.json?.competitor?.id;
  if (!rateCompId) return t;
  let exp200 = 0;
  let exp429 = 0;
  for (let i = 0; i < 40; i++) {
    const r = await ctx.C.post(`/api/competitors/${rateCompId}/analyze`);
    if (r.status === 200) exp200++;
    else if (r.status === 429) exp429++;
  }
  eq(t, "expensive rate limit: 30 of 40 analyse calls get 200", exp200, 30);
  eq(t, "expensive rate limit: 10 of 40 analyse calls get 429", exp429, 10);

  return t;
}
