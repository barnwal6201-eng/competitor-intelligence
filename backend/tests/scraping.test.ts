// Area 3 — scraping against the mock site (real scrapers, real Mongo).
// Also seeds the change data the later areas (analysis, battlecards,
// dashboard, integrations) build on.
import { check, eq, expectStatus, scanAndWait, siteUrl, tally, type SuiteCtx, type Tally } from "./helpers";

function bySource(results: { sourceType: string; outcome: string; changesDetected?: number }[], source: string) {
  return results.find((r) => r.sourceType === source);
}

export async function run(ctx: SuiteCtx, mockSite: any): Promise<Tally> {
  const t = tally("scraping");
  const { A } = ctx;

  // Competitor watching all four mock pages.
  const created = await A.post("/api/competitors", {
    companyName: "Mock Rival",
    websiteUrl: siteUrl(ctx, "/"),
    pricingPageUrl: siteUrl(ctx, "/pricing"),
    changelogUrl: siteUrl(ctx, "/changelog"),
    careersPageUrl: siteUrl(ctx, "/careers"),
    reviewSourceUrl: siteUrl(ctx, "/reviews"),
    monitoringFrequency: "daily",
  });
  expectStatus(t, "scan competitor creates 201", created, 201);
  const compId: string | undefined = created.json?.competitor?.id;
  if (!compId) return t;
  ctx.state.scanCompId = compId;

  // Baseline scan: every source stores a new snapshot, zero changes.
  const baseline = await scanAndWait(ctx, A, compId);
  eq(t, "baseline scans 4 sources", baseline.length, 4);
  for (const src of ["pricing", "changelog", "careers", "reviews"]) {
    eq(t, `baseline ${src} outcome is created`, bySource(baseline, src)?.outcome, "created");
    eq(t, `baseline ${src} detects 0 changes`, bySource(baseline, src)?.changesDetected ?? 0, 0);
  }
  const snaps1 = await A.get(`/api/competitors/${compId}/snapshots`);
  eq(t, "baseline stores 4 snapshots", snaps1.json?.snapshots?.length, 4);
  const pricingSnap = (snaps1.json?.snapshots ?? []).find((s: any) => s.sourceType === "pricing");
  check(t, "pricing snapshot extracted 3 plans", (pricingSnap?.extractedData?.plans ?? []).length === 3, JSON.stringify(pricingSnap?.extractedData));
  check(
    t,
    "pricing snapshot has Pro at $29",
    (pricingSnap?.extractedData?.plans ?? []).some((p: any) => p.name === "Pro" && p.price === 29),
    JSON.stringify(pricingSnap?.extractedData)
  );
  ctx.state.firstPricingSnapshotId = pricingSnap?.id;

  // Unchanged rescan: every source "unchanged", no new snapshots.
  const unchanged = await scanAndWait(ctx, A, compId);
  for (const src of ["pricing", "changelog", "careers", "reviews"]) {
    eq(t, `unchanged rescan ${src} outcome is unchanged`, bySource(unchanged, src)?.outcome, "unchanged");
  }
  const snaps2 = await A.get(`/api/competitors/${compId}/snapshots`);
  eq(t, "unchanged rescan stores no new snapshots", snaps2.json?.snapshots?.length, 4);

  // Change every page, then rescan: every source stores a new snapshot.
  mockSite.setPrice("Pro", 39);
  mockSite.setPrice("Starter", 8);
  mockSite.addPlan("Team", 49);
  mockSite.removePlan("Enterprise");
  mockSite.addEntry({ title: "AI summaries launch", date: "2026-11-20", desc: "Summaries of competitor moves, generated daily." });
  mockSite.addJob({ title: "Frontend Engineer", location: "Bengaluru, India" });
  mockSite.addReview({ text: "Terrible update, the app crashes every day and support never replies.", rating: 1 });
  const changed = await scanAndWait(ctx, A, compId);
  for (const src of ["pricing", "changelog", "careers", "reviews"]) {
    eq(t, `changed rescan ${src} outcome is created`, bySource(changed, src)?.outcome, "created");
  }
  check(t, "changed rescan detects pricing changes", (bySource(changed, "pricing")?.changesDetected ?? 0) >= 3, JSON.stringify(changed));
  const snaps3 = await A.get(`/api/competitors/${compId}/snapshots`);
  eq(t, "changed rescan stores 4 more snapshots", snaps3.json?.snapshots?.length, 8);
  const pricingSnaps = await A.get(`/api/competitors/${compId}/snapshots?type=pricing`);
  eq(t, "snapshots ?type=pricing filters to pricing only", pricingSnaps.json?.snapshots?.length, 2);
  check(
    t,
    "latest pricing snapshot has Pro at $39 and a Team plan",
    (pricingSnaps.json?.snapshots?.[0]?.extractedData?.plans ?? []).some((p: any) => p.name === "Pro" && p.price === 39) &&
      (pricingSnaps.json?.snapshots?.[0]?.extractedData?.plans ?? []).some((p: any) => p.name === "Team"),
    JSON.stringify(pricingSnaps.json?.snapshots?.[0]?.extractedData)
  );

  // Robots-blocked source: pricing URL under a disallowed path. The
  // website URL must differ from the scan competitor's, or the
  // per-org website uniqueness rule answers 409.
  const blocked = await A.post("/api/competitors", {
    companyName: "Blocked Co",
    websiteUrl: siteUrl(ctx, "/?site=blocked-co"),
    pricingPageUrl: siteUrl(ctx, "/blocked-pricing"),
  });
  expectStatus(t, "robots competitor creates 201", blocked, 201);
  const blockedId: string | undefined = blocked.json?.competitor?.id;
  if (!blockedId) return t;
  ctx.state.blockedCompId = blockedId;
  const blockedScan = await scanAndWait(ctx, A, blockedId);
  eq(t, "robots-blocked pricing outcome is blocked", bySource(blockedScan, "pricing")?.outcome, "blocked");
  const blockedSnaps = await A.get(`/api/competitors/${blockedId}/snapshots`);
  check(
    t,
    "blocked scan stores a blocked snapshot",
    (blockedSnaps.json?.snapshots ?? []).some((s: any) => s.sourceType === "pricing" && s.status === "blocked"),
    JSON.stringify(blockedSnaps.json?.snapshots)
  );

  // Cross-org + unauthenticated snapshot access.
  const crossSnaps = await ctx.B.get(`/api/competitors/${compId}/snapshots`);
  expectStatus(t, "cross-org snapshots return 404", crossSnaps, 404);
  const crossScan = await ctx.B.post(`/api/competitors/${compId}/scan`);
  expectStatus(t, "cross-org scan returns 404", crossScan, 404);

  return t;
}
