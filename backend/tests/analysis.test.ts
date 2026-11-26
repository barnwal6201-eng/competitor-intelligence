// Area 6 — AI analysis via the mock Groq server.
import { analyse, check, Client, eq, expectStatus, scanAndWait, startBackend, stopBackend, tally, TEST_DB_URI, waitForHealth, type SuiteCtx, type Tally } from "./helpers";

const SEVEN_KEYS = ["summary", "implications", "strengths", "weaknesses", "suggestedResponses", "talkingPoints", "confidence"];

export async function run(ctx: SuiteCtx, mockGroq: any, mockSite: any): Promise<Tally> {
  const t = tally("analysis");
  const { A, B } = ctx;
  const compId: string = ctx.state.scanCompId;
  const blockedId: string = ctx.state.blockedCompId;

  // Valid analysis: all 7 keys, source changes recorded, model + usage.
  mockGroq.mode = "ok";
  const callsBefore = mockGroq.calls;
  const first = await analyse(ctx, A, compId);
  expectStatus(t, "analyse returns 200", first, 200);
  const analysis = first.json?.analysis;
  check(t, "analyse stores an analysis", !!analysis?.id, JSON.stringify(first.json));
  for (const key of SEVEN_KEYS) {
    check(t, `analysis has key ${key}`, analysis?.[key] !== undefined && analysis?.[key] !== null);
  }
  eq(t, "analysis confidence is medium (mock)", analysis?.confidence, "medium");
  check(t, "analysis records its source changes", Array.isArray(analysis?.changeIds) && analysis.changeIds.length > 0, JSON.stringify(analysis?.changeIds));
  check(t, "analysis records the mock model", analysis?.aiModel === "openai/gpt-oss-120b", String(analysis?.aiModel));
  check(t, "analysis records token usage", analysis?.promptTokens === 120 && analysis?.completionTokens === 80, JSON.stringify(analysis));
  check(t, "analyse called the mock Groq server once", mockGroq.calls === callsBefore + 1, `calls=${mockGroq.calls}`);
  check(t, "Groq prompt names the competitor", JSON.stringify(mockGroq.lastBody).includes("Mock Rival"), JSON.stringify(mockGroq.lastBody)?.slice(0, 300));
  ctx.state.analysisId = analysis?.id;

  // History + single read.
  const history = await A.get(`/api/competitors/${compId}/analyses`);
  expectStatus(t, "analyses list returns 200", history, 200);
  check(t, "analyses list contains the new analysis", (history.json?.analyses ?? []).some((a: any) => a.id === analysis?.id));
  const one = await A.get(`/api/competitors/${compId}/analyses/${analysis.id}`);
  expectStatus(t, "single analysis returns 200", one, 200);
  eq(t, "single analysis matches", one.json?.analysis?.id, analysis?.id);

  // No new changes → { analysis: null }.
  const again = await analyse(ctx, A, compId);
  expectStatus(t, "analyse with no new changes returns 200", again, 200);
  check(t, "analyse with no new changes returns analysis null", again.json?.analysis === null, JSON.stringify(again.json));

  // changeIds validation: malformed ids → 400; ids of another competitor → 400.
  const badIds = await analyse(ctx, A, compId, { changeIds: ["not-an-objectid"] });
  expectStatus(t, "analyse with malformed changeIds returns 400", badIds, 400);
  const ghostIds = await analyse(ctx, A, compId, { changeIds: ["000000000000000000000001"] });
  expectStatus(t, "analyse with unknown changeIds returns 400", ghostIds, 400);
  const crossIds = await analyse(ctx, A, blockedId, { changeIds: (ctx.state.changeIds ?? []).slice(0, 1) });
  expectStatus(t, "analyse with another competitor's changeIds returns 400", crossIds, 400);
  const emptyIds = await analyse(ctx, A, compId, { changeIds: [] });
  expectStatus(t, "analyse with empty changeIds returns 400", emptyIds, 400);

  // Cross-org 404 + unauthenticated 401.
  const cross = await B.post(`/api/competitors/${compId}/analyze`);
  expectStatus(t, "cross-org analyse returns 404", cross, 404);
  const crossList = await B.get(`/api/competitors/${compId}/analyses`);
  expectStatus(t, "cross-org analyses list returns 404", crossList, 404);
  const anon = new Client(ctx.baseUrl);
  const unauth = await anon.post(`/api/competitors/${compId}/analyze`);
  expectStatus(t, "analyse without auth returns 401", unauth, 401);

  // Bad Groq responses: each needs a fresh unanalysed change, so bump
  // the mock price and rescan before each attempt.
  async function freshChange(): Promise<void> {
    const current = mockSite.plans.find((p: any) => p.name === "Pro")?.price ?? 42;
    mockSite.setPrice("Pro", current + 1);
    await scanAndWait(ctx, A, compId);
  }
  async function countAnalyses(): Promise<number> {
    const h = await A.get(`/api/competitors/${compId}/analyses?limit=50`);
    return h.json?.analyses?.length ?? -1;
  }

  mockGroq.mode = "invalid-json";
  await freshChange();
  const beforeInvalid = await countAnalyses();
  const invalid = await analyse(ctx, A, compId);
  expectStatus(t, "invalid JSON from Groq returns 502", invalid, 502);
  eq(t, "invalid JSON saves nothing", await countAnalyses(), beforeInvalid);

  mockGroq.mode = "wrong-shape";
  await freshChange();
  const beforeShape = await countAnalyses();
  const wrongShape = await analyse(ctx, A, compId);
  expectStatus(t, "wrong-shape JSON from Groq returns 502", wrongShape, 502);
  eq(t, "wrong-shape JSON saves nothing", await countAnalyses(), beforeShape);

  mockGroq.mode = "unauthorized";
  await freshChange();
  const before401 = await countAnalyses();
  const unauthGroq = await analyse(ctx, A, compId);
  expectStatus(t, "Groq 401 returns 502", unauthGroq, 502);
  eq(t, "Groq 401 saves nothing", await countAnalyses(), before401);
  mockGroq.mode = "ok";

  // No API key → 503. A separate backend pass with OPENAI_API_KEY unset
  // (same DB + JWT secret, so org A's cookie still works). The explicit
  // changeIds path bypasses the already-covered check, so the key check
  // is reached even though the change was analysed before.
  const noKeyPort = ctx.mode === "no-redis" ? 5199 : 5198;
  const noKey = startBackend({
    port: noKeyPort,
    logTag: `nokey-${ctx.mode}`,
    env: {
      PORT: String(noKeyPort),
      NODE_ENV: "development",
      MONGODB_URI: TEST_DB_URI,
      JWT_SECRET: "test-secret-123",
      FRONTEND_URL: "http://localhost:3000",
      REDIS_URL: "redis://127.0.0.1:6390",
      SCAN_WORKER_IN_PROCESS: "true",
      ALLOW_PRIVATE_SCRAPE_URLS: "true",
      OPENAI_API_KEY: "",
      GROQ_API_BASE_URL: `http://127.0.0.1:${ctx.mockGroqPort}`,
    },
  });
  try {
    await waitForHealth(noKey.baseUrl);
    const noKeyClient = new Client(noKey.baseUrl);
    noKeyClient.cookie = A.cookie; // same secret + same DB → valid session
    const noKeyRes = await noKeyClient.post(`/api/competitors/${compId}/analyze`, {
      changeIds: ctx.state.changeIds.slice(0, 1),
    });
    expectStatus(t, "analyse without an API key returns 503", noKeyRes, 503);
  } finally {
    await stopBackend(noKey);
  }

  return t;
}
