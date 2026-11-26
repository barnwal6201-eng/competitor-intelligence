// Area 5 — change detection: pure detector unit tests + end-to-end
// checks against the changes the scraping area's rescan produced.
import { detectChanges } from "../src/changes/detector";
import { check, eq, expectStatus, tally, type SuiteCtx, type Tally } from "./helpers";

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("changes");
  const { A, B } = ctx;
  const compId: string = ctx.state.scanCompId;

  // ---- pure detector unit tests (no DB, no network) ----
  const has = (list: { category: string; significance: string }[], category: string, sig: string) =>
    list.some((c) => c.category === category && c.significance === sig);

  check(t, "detector: no previous data is a baseline ([]) ", detectChanges(undefined, { plans: [] }, "pricing").length === 0);
  check(t, "detector: identical data is no change", detectChanges({ plans: [{ name: "Pro", price: 29 }] }, { plans: [{ name: "Pro", price: 29 }] }, "pricing").length === 0);
  check(
    t,
    "detector: reordered plans are no change",
    detectChanges(
      { plans: [{ name: "A", price: 10 }, { name: "B", price: 20 }] },
      { plans: [{ name: "B", price: 20 }, { name: "A", price: 10 }] },
      "pricing"
    ).length === 0
  );
  const price = detectChanges(
    { plans: [{ name: "Pro", price: 29 }, { name: "Starter", price: 10 }, { name: "Old", price: 5 }] },
    { plans: [{ name: "Pro", price: 39 }, { name: "Starter", price: 8 }, { name: "Team", price: 49 }] },
    "pricing"
  );
  check(t, "detector: price increase is high", has(price, "price_increase", "high"));
  check(t, "detector: price decrease is medium", has(price, "price_decrease", "medium"));
  check(t, "detector: new plan is medium", has(price, "plan_added", "medium"));
  check(t, "detector: removed plan is high", has(price, "plan_removed", "high"));
  eq(t, "detector: pricing diff yields exactly 4 changes", price.length, 4);

  const changelog = detectChanges(
    { entries: [{ title: "Old feature" }] },
    { entries: [{ title: "Old feature" }, { title: "New feature" }] },
    "changelog"
  );
  check(t, "detector: new changelog entry is medium", has(changelog, "entry_added", "medium"));
  const changelogRemoved = detectChanges(
    { entries: [{ title: "Gone" }] },
    { entries: [] },
    "changelog"
  );
  check(t, "detector: removed changelog entry is low", has(changelogRemoved, "entry_removed", "low"));

  const careers = detectChanges(
    { jobs: [{ title: "Support Engineer", location: "Remote" }] },
    { jobs: [{ title: "Support Engineer", location: "Remote" }, { title: "Frontend Engineer", location: "Bengaluru, India" }] },
    "careers"
  );
  check(t, "detector: new job is low", has(careers, "job_posted", "low"));
  const careersRemoved = detectChanges(
    { jobs: [{ title: "Old Job", location: "Remote" }] },
    { jobs: [] },
    "careers"
  );
  check(t, "detector: removed job is low", has(careersRemoved, "job_removed", "low"));

  const reviews = detectChanges(
    { reviews: [{ text: "Great product, love it a lot.", rating: 5 }] },
    {
      reviews: [
        { text: "Great product, love it a lot.", rating: 5 },
        { text: "Terrible update, the app crashes every day.", rating: 1 },
        { text: "Pretty good overall, does the job well.", rating: 4 },
      ],
    },
    "reviews"
  );
  check(t, "detector: negative review (1 star) is high", has(reviews, "negative_review", "high"));
  check(t, "detector: ordinary new review is low", has(reviews, "review_added", "low"));
  eq(t, "detector: reviews diff yields exactly 2 changes", reviews.length, 2);

  // ---- end-to-end: the rescan's changes, via the API ----
  const changes = await A.get(`/api/competitors/${compId}/changes?limit=50`);
  expectStatus(t, "changes list returns 200", changes, 200);
  const list: any[] = changes.json?.changes ?? [];
  ctx.state.changeIds = list.map((c: any) => c.id);
  ctx.state.firstChangeId = list[0]?.id;
  const cats = (category: string, sig: string) => list.some((c: any) => c.category === category && c.significance === sig);
  check(t, "e2e: price increase (high) detected", cats("price_increase", "high"));
  check(t, "e2e: price decrease (medium) detected", cats("price_decrease", "medium"));
  check(t, "e2e: plan added (medium) detected", cats("plan_added", "medium"));
  check(t, "e2e: plan removed (high) detected", cats("plan_removed", "high"));
  check(t, "e2e: changelog entry added (medium) detected", cats("entry_added", "medium"));
  check(t, "e2e: job posted (low) detected", cats("job_posted", "low"));
  check(t, "e2e: negative review (high) detected", cats("negative_review", "high"));
  check(t, "e2e: at least 7 changes from the rescan", list.length >= 7, `got ${list.length}`);

  const highOnly = await A.get(`/api/competitors/${compId}/changes?significance=high&limit=50`);
  check(t, "e2e: significance=high filter returns only high", (highOnly.json?.changes ?? []).every((c: any) => c.significance === "high") && (highOnly.json?.changes ?? []).length > 0);
  const pricingOnly = await A.get(`/api/competitors/${compId}/changes?type=pricing&limit=50`);
  check(t, "e2e: type=pricing filter returns only pricing", (pricingOnly.json?.changes ?? []).every((c: any) => c.sourceType === "pricing") && (pricingOnly.json?.changes ?? []).length > 0);

  const feed = await A.get("/api/changes?limit=50");
  expectStatus(t, "intelligence feed returns 200", feed, 200);
  check(t, "e2e: feed contains the competitor's changes", (feed.json?.changes ?? []).some((c: any) => c.competitorId === compId));
  check(t, "e2e: feed rows carry the competitor name", (feed.json?.changes ?? []).every((c: any) => typeof c.competitorName === "string" && c.competitorName.length > 0));

  const cross = await B.get(`/api/competitors/${compId}/changes`);
  expectStatus(t, "e2e: cross-org changes return 404", cross, 404);
  const crossFeed = await B.get("/api/changes");
  expectStatus(t, "e2e: org B feed is empty (isolation)", crossFeed, 200);
  eq(t, "e2e: org B feed has 0 changes", crossFeed.json?.changes?.length, 0);

  return t;
}
