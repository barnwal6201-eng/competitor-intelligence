// Area 2 — competitors CRUD.
import { Client, check, eq, expectStatus, tally, type SuiteCtx, type Tally } from "./helpers";

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("competitors");
  const { A, B } = ctx;

  // create 201 with defaults
  const created = await A.post("/api/competitors", {
    companyName: "Acme Corp",
    websiteUrl: "https://acme.example.com",
  });
  expectStatus(t, "create returns 201", created, 201);
  const acme = created.json?.competitor;
  check(t, "create applies daily/ enabled defaults", acme?.monitoringFrequency === "daily" && acme?.isMonitoringEnabled === true, JSON.stringify(acme));
  eq(t, "create scopes to org A", acme?.organizationId, ctx.orgA);
  ctx.state.acmeId = acme?.id;

  // list contains it; get returns it
  const list = await A.get("/api/competitors");
  expectStatus(t, "list returns 200", list, 200);
  check(t, "list contains the new competitor", (list.json?.competitors ?? []).some((c: any) => c.id === acme?.id));
  const got = await A.get(`/api/competitors/${acme.id}`);
  expectStatus(t, "get returns 200", got, 200);
  eq(t, "get returns the company name", got.json?.competitor?.companyName, "Acme Corp");

  // search + monitoring filter
  const searched = await A.get("/api/competitors?search=acme");
  check(t, "search finds by name", (searched.json?.competitors ?? []).some((c: any) => c.id === acme.id));
  const missed = await A.get("/api/competitors?search=zzz-no-such-company");
  eq(t, "search with no match returns empty", missed.json?.competitors?.length, 0);
  const enabled = await A.get("/api/competitors?monitoring=enabled");
  check(t, "monitoring=enabled includes it", (enabled.json?.competitors ?? []).some((c: any) => c.id === acme.id));
  const paused = await A.get("/api/competitors?monitoring=paused");
  check(t, "monitoring=paused excludes it", !(paused.json?.competitors ?? []).some((c: any) => c.id === acme.id));

  // update 200 (rename + pause), then un-pause for later areas
  const updated = await A.patch(`/api/competitors/${acme.id}`, {
    companyName: "Acme Corp Ltd",
    isMonitoringEnabled: false,
  });
  expectStatus(t, "update returns 200", updated, 200);
  eq(t, "update renames", updated.json?.competitor?.companyName, "Acme Corp Ltd");
  eq(t, "update pauses monitoring", updated.json?.competitor?.isMonitoringEnabled, false);
  const resumed = await A.patch(`/api/competitors/${acme.id}`, { isMonitoringEnabled: true });
  expectStatus(t, "resume returns 200", resumed, 200);

  // clear an optional URL with "" (stored as removed, not "")
  const withPricing = await A.patch(`/api/competitors/${acme.id}`, {
    pricingPageUrl: "https://acme.example.com/pricing",
  });
  expectStatus(t, "set pricing URL returns 200", withPricing, 200);
  const cleared = await A.patch(`/api/competitors/${acme.id}`, { pricingPageUrl: "" });
  expectStatus(t, "clear pricing URL returns 200", cleared, 200);
  check(t, "cleared URL is absent, not an empty string", cleared.json?.competitor?.pricingPageUrl === undefined, JSON.stringify(cleared.json?.competitor));

  // validation 400s
  const badUrl = await A.post("/api/competitors", { companyName: "Bad", websiteUrl: "not-a-url" });
  expectStatus(t, "create with bad URL returns 400", badUrl, 400);
  const shortName = await A.post("/api/competitors", { companyName: "X", websiteUrl: "https://x.example.com" });
  expectStatus(t, "create with 1-char name returns 400", shortName, 400);
  const emptyUpdate = await A.patch(`/api/competitors/${acme.id}`, {});
  expectStatus(t, "empty update returns 400", emptyUpdate, 400);
  const badFreq = await A.patch(`/api/competitors/${acme.id}`, { monitoringFrequency: "monthly" });
  expectStatus(t, "bad frequency returns 400", badFreq, 400);

  // duplicate website 409 in the same org, allowed in another org
  const dup = await A.post("/api/competitors", { companyName: "Acme Again", websiteUrl: "https://acme.example.com" });
  expectStatus(t, "duplicate website in same org returns 409", dup, 409);
  const otherOrg = await B.post("/api/competitors", { companyName: "Acme Corp", websiteUrl: "https://acme.example.com" });
  expectStatus(t, "same website in another org returns 201", otherOrg, 201);
  ctx.state.acmeBId = otherOrg.json?.competitor?.id;
  const dupB = await B.post("/api/competitors", { companyName: "Acme 2", websiteUrl: "https://acme.example.com" });
  expectStatus(t, "duplicate website in org B returns 409", dupB, 409);

  // cross-org 404s (indistinguishable from missing)
  const crossGet = await B.get(`/api/competitors/${acme.id}`);
  expectStatus(t, "cross-org get returns 404", crossGet, 404);
  const crossPatch = await B.patch(`/api/competitors/${acme.id}`, { companyName: "Hijacked" });
  expectStatus(t, "cross-org patch returns 404", crossPatch, 404);
  const crossDel = await B.del(`/api/competitors/${acme.id}`);
  expectStatus(t, "cross-org delete returns 404", crossDel, 404);
  const missing = await A.get("/api/competitors/000000000000000000000000");
  expectStatus(t, "missing competitor returns 404", missing, 404);

  // unauthenticated 401s
  const anon = new Client(ctx.baseUrl);
  const unauthList = await anon.get("/api/competitors");
  expectStatus(t, "list without auth returns 401", unauthList, 401);
  const unauthCreate = await anon.post("/api/competitors", { companyName: "X", websiteUrl: "https://x.example.com" });
  expectStatus(t, "create without auth returns 401", unauthCreate, 401);

  // delete 200, then gone
  const doomed = await A.post("/api/competitors", { companyName: "Doomed Inc", websiteUrl: "https://doomed.example.com" });
  expectStatus(t, "throwaway competitor creates 201", doomed, 201);
  const del = await A.del(`/api/competitors/${doomed.json.competitor.id}`);
  expectStatus(t, "delete returns 200", del, 200);
  const gone = await A.get(`/api/competitors/${doomed.json.competitor.id}`);
  expectStatus(t, "deleted competitor returns 404", gone, 404);

  return t;
}
