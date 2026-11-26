// Area 8 — dashboard: exact counts, 14-day series, windows, isolation.
import mongoose from "mongoose";
import { Change } from "../src/models/Change";
import { Snapshot } from "../src/models/Snapshot";
import { check, Client, eq, expectStatus, register, scanAndWait, siteUrl, tally, type SuiteCtx, type Tally } from "./helpers";

export async function run(ctx: SuiteCtx, mockSite: any): Promise<Tally> {
  const t = tally("dashboard");
  const { A, B } = ctx;

  // Fresh org D with one competitor and fully controlled history.
  const dClient = new Client(ctx.baseUrl);
  const regD = await register(dClient, "Dash User", `dash-${ctx.mode}@phase11.test`, "Dash Org");
  expectStatus(t, "org D registers 201", regD, 201);
  ctx.state.D = dClient;
  const orgD: string = regD.json.user.organization.id;

  const created = await dClient.post("/api/competitors", {
    companyName: "Dash Rival",
    websiteUrl: siteUrl(ctx, "/"),
    pricingPageUrl: siteUrl(ctx, "/pricing"),
    changelogUrl: siteUrl(ctx, "/changelog"),
    careersPageUrl: siteUrl(ctx, "/careers"),
    reviewSourceUrl: siteUrl(ctx, "/reviews"),
  });
  expectStatus(t, "dash competitor creates 201", created, 201);
  const compId: string | undefined = created.json?.competitor?.id;
  if (!compId) return t;

  await scanAndWait(ctx, dClient, compId); // baseline: 4 snapshots, 0 changes
  const proNow = mockSite.plans.find((p: any) => p.name === "Pro")?.price ?? 42;
  mockSite.setPrice("Pro", proNow + 3);
  await scanAndWait(ctx, dClient, compId); // 1 new pricing snapshot, 1 price_increase

  // Seed one 10-day-old change directly (low significance, so it cannot
  // pollute the 7-day high-priority count).
  const snaps = await Snapshot.find({ competitorId: new mongoose.Types.ObjectId(compId) })
    .sort({ scrapedAt: -1 })
    .lean();
  const newest = snaps[0];
  const previous = snaps[1] ?? snaps[0];
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  await Change.create({
    organizationId: new mongoose.Types.ObjectId(orgD),
    competitorId: new mongoose.Types.ObjectId(compId),
    snapshotId: newest._id,
    previousSnapshotId: previous._id,
    sourceType: "careers",
    category: "job_posted",
    significance: "low",
    title: "New job posted: Old Role (Remote)",
    newValue: "Old Role",
    sourceUrl: siteUrl(ctx, "/careers"),
    detectedAt: tenDaysAgo,
  });

  const dash = await dClient.get("/api/dashboard/overview");
  expectStatus(t, "dashboard returns 200", dash, 200);
  const s = dash.json?.stats;
  eq(t, "stats.competitors is 1", s?.competitors, 1);
  eq(t, "stats.monitoringEnabled is 1", s?.monitoringEnabled, 1);
  eq(t, "stats.monitoringPaused is 0", s?.monitoringPaused, 0);
  eq(t, "stats.snapshots is 5 (4 baseline + 1 changed)", s?.snapshots, 5);
  eq(t, "stats.changes is 2 (1 new + 1 ten-day-old)", s?.changes, 2);
  eq(t, "stats.changesLast7Days excludes the 10-day-old change", s?.changesLast7Days, 1);
  eq(t, "stats.highChangesLast7Days is 1 (the price increase)", s?.highChangesLast7Days, 1);
  eq(t, "stats.battlecards is 0", s?.battlecards, 0);
  eq(t, "stats.analyses is 0", s?.analyses, 0);

  const series: { date: string; count: number }[] = dash.json?.changesPerDay ?? [];
  eq(t, "14-day series has 14 buckets", series.length, 14);
  eq(t, "14-day series sums to all changes", series.reduce((a, b) => a + b.count, 0), 2);
  const today = new Date().toISOString().slice(0, 10);
  eq(t, "today's bucket has the 1 new change", series.find((d) => d.date === today)?.count, 1);
  const tenDaysAgoKey = tenDaysAgo.toISOString().slice(0, 10);
  eq(t, "10-days-ago bucket has the seeded change", series.find((d) => d.date === tenDaysAgoKey)?.count, 1);
  check(t, "quiet days are zero-filled", series.some((d) => d.count === 0), JSON.stringify(series));

  const top = dash.json?.topCompetitors ?? [];
  eq(t, "top competitors has 1 row", top.length, 1);
  eq(t, "top competitor change count is 2", top[0]?.changeCount, 2);
  eq(t, "top competitor name matches", top[0]?.competitorName, "Dash Rival");

  const moves = dash.json?.priceMoves ?? [];
  eq(t, "price moves has exactly the 1 price change", moves.length, 1);
  eq(t, "price move is a price_increase", moves[0]?.category, "price_increase");
  check(t, "price moves carry only price categories", moves.every((m: any) => m.category === "price_increase" || m.category === "price_decrease"));

  const recent = dash.json?.recentChanges ?? [];
  eq(t, "recent changes has 2 rows", recent.length, 2);

  const health = dash.json?.scanHealth ?? [];
  eq(t, "scan health has 1 row", health.length, 1);
  eq(t, "scan health total snapshots is 5", health[0]?.totalSnapshots, 5);
  eq(t, "scan health last status is success", health[0]?.lastScanStatus, "success");
  check(t, "scan health has a last scan time", typeof health[0]?.lastScanAt === "string");

  // Cross-org isolation: org A sees none of org D's data, and vice versa.
  const dashA = await A.get("/api/dashboard/overview");
  check(t, "org A dashboard does not count org D's competitor", (dashA.json?.topCompetitors ?? []).every((c: any) => c.competitorName !== "Dash Rival"));
  const dashB = await B.get("/api/dashboard/overview");
  eq(t, "org B dashboard has 1 competitor (its own Acme copy)", dashB.json?.stats?.competitors, 1);

  // Empty org: honest zeros.
  const eClient = new Client(ctx.baseUrl);
  const regE = await register(eClient, "Empty User", `empty-${ctx.mode}@phase11.test`, "Empty Org");
  expectStatus(t, "org E registers 201", regE, 201);
  const empty = await eClient.get("/api/dashboard/overview");
  expectStatus(t, "empty dashboard returns 200", empty, 200);
  const es = empty.json?.stats;
  check(
    t,
    "empty org stats are all zero",
    es?.competitors === 0 && es?.snapshots === 0 && es?.changes === 0 && es?.battlecards === 0 && es?.analyses === 0,
    JSON.stringify(es)
  );
  eq(t, "empty org series is 14 zero buckets", (empty.json?.changesPerDay ?? []).length, 14);
  check(t, "empty org series sums to 0", (empty.json?.changesPerDay ?? []).reduce((a: number, b: any) => a + b.count, 0) === 0);
  eq(t, "empty org top competitors is []", empty.json?.topCompetitors?.length, 0);
  eq(t, "empty org price moves is []", empty.json?.priceMoves?.length, 0);
  eq(t, "empty org scan health is []", empty.json?.scanHealth?.length, 0);

  // Unauthenticated 401.
  const anon = new Client(ctx.baseUrl);
  const unauth = await anon.get("/api/dashboard/overview");
  expectStatus(t, "dashboard without auth returns 401", unauth, 401);

  return t;
}
