// Area 7 — battlecards: generate / regenerate / edit / versions.
import { check, Client, eq, expectStatus, tally, type SuiteCtx, type Tally } from "./helpers";

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("battlecards");
  const { A, B } = ctx;
  const compId: string = ctx.state.scanCompId;

  // 400 without any snapshots: a fresh competitor cannot get a card.
  const fresh = await A.post("/api/competitors", {
    companyName: "Unscanned Co",
    websiteUrl: "https://unscanned.example.com",
  });
  expectStatus(t, "unscanned competitor creates 201", fresh, 201);
  const freshId: string = fresh.json.competitor.id;
  const tooSoon = await A.post(`/api/competitors/${freshId}/battlecard/generate`);
  expectStatus(t, "generate without snapshots returns 400", tooSoon, 400);

  // Generate 201: verified pricing from the latest snapshot + AI sections.
  const gen = await A.post(`/api/competitors/${compId}/battlecard/generate`);
  expectStatus(t, "generate returns 201", gen, 201);
  const card = gen.json?.battlecard;
  eq(t, "generated card is version 1", card?.version, 1);
  check(t, "card pricing lists the Pro plan", (card?.pricing ?? []).some((p: any) => p.name === "Pro"), JSON.stringify(card?.pricing));
  check(t, "card features list the changelog entry", (card?.features ?? []).some((f: any) => String(f.title).includes("AI summaries")), JSON.stringify(card?.features));
  check(t, "card complaints include the 1-star review", (card?.complaints ?? []).some((c: any) => c.rating === 1), JSON.stringify(card?.complaints));
  check(t, "card strengths come from the analysis", (card?.strengths ?? []).length > 0, JSON.stringify(card?.strengths));
  check(t, "card recent changes are present", (card?.recentChanges ?? []).length > 0, JSON.stringify(card?.recentChanges));
  check(t, "card sources are present", (card?.sources ?? []).length > 0, JSON.stringify(card?.sources));
  ctx.state.battlecardCompId = compId;

  // Second generate → 409.
  const again = await A.post(`/api/competitors/${compId}/battlecard/generate`);
  expectStatus(t, "second generate returns 409", again, 409);

  // Get + org-wide list.
  const got = await A.get(`/api/competitors/${compId}/battlecard`);
  expectStatus(t, "get battlecard returns 200", got, 200);
  eq(t, "get returns version 1", got.json?.battlecard?.version, 1);
  const list = await A.get("/api/battlecards");
  expectStatus(t, "battlecards list returns 200", list, 200);
  check(t, "list contains the card", (list.json?.battlecards ?? []).some((b: any) => b.competitorId === compId));

  // Edit an editable section → version 2; the old version stays frozen.
  const originalOverview = card?.overview;
  const edited = await A.put(`/api/competitors/${compId}/battlecard`, {
    overview: "Edited overview for the sales call.",
  });
  expectStatus(t, "edit returns 200", edited, 200);
  eq(t, "edit bumps to version 2", edited.json?.battlecard?.version, 2);
  eq(t, "edit applies the new overview", edited.json?.battlecard?.overview, "Edited overview for the sales call.");
  const versions = await A.get(`/api/competitors/${compId}/battlecard/versions`);
  expectStatus(t, "versions list returns 200", versions, 200);
  eq(t, "versions list has v1 and v2", (versions.json?.versions ?? []).map((v: any) => v.version).sort(), [1, 2]);
  const v1 = await A.get(`/api/competitors/${compId}/battlecard/versions/1`);
  expectStatus(t, "frozen v1 returns 200", v1, 200);
  eq(t, "frozen v1 keeps the original overview", v1.json?.version?.content?.overview, originalOverview);
  const vMissing = await A.get(`/api/competitors/${compId}/battlecard/versions/99`);
  expectStatus(t, "missing version returns 404", vMissing, 404);

  // Verified fields are not editable; empty edit is rejected.
  const badEdit = await A.put(`/api/competitors/${compId}/battlecard`, {
    pricing: [{ name: "Fake", price: 1 }],
  });
  expectStatus(t, "editing verified pricing returns 400", badEdit, 400);
  const badEdit2 = await A.put(`/api/competitors/${compId}/battlecard`, {
    features: [{ title: "Invented feature" }],
  });
  expectStatus(t, "editing verified features returns 400", badEdit2, 400);
  const emptyEdit = await A.put(`/api/competitors/${compId}/battlecard`, {});
  expectStatus(t, "empty edit returns 400", emptyEdit, 400);

  // Regenerate → version 3, picking up the latest data.
  const regen = await A.post(`/api/competitors/${compId}/battlecard/regenerate`);
  expectStatus(t, "regenerate returns 200", regen, 200);
  eq(t, "regenerate bumps to version 3", regen.json?.battlecard?.version, 3);
  const versions2 = await A.get(`/api/competitors/${compId}/battlecard/versions`);
  eq(t, "versions list now has v1, v2, v3", (versions2.json?.versions ?? []).map((v: any) => v.version).sort(), [1, 2, 3]);

  // Cross-org 404s + unauthenticated 401.
  const crossGet = await B.get(`/api/competitors/${compId}/battlecard`);
  expectStatus(t, "cross-org get returns 404", crossGet, 404);
  const crossGen = await B.post(`/api/competitors/${compId}/battlecard/generate`);
  expectStatus(t, "cross-org generate returns 404", crossGen, 404);
  const crossRegen = await B.post(`/api/competitors/${compId}/battlecard/regenerate`);
  expectStatus(t, "cross-org regenerate returns 404", crossRegen, 404);
  const anon = new Client(ctx.baseUrl);
  const unauth = await anon.get(`/api/competitors/${compId}/battlecard`);
  expectStatus(t, "get without auth returns 401", unauth, 401);
  const unauthList = await anon.get("/api/battlecards");
  expectStatus(t, "list without auth returns 401", unauthList, 401);

  return t;
}
