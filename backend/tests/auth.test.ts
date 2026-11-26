// Area 1 — auth: register / login / logout / me.
import { Client, check, eq, expectStatus, noPasswordHash, register, tally, type SuiteCtx, type Tally } from "./helpers";

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("auth");
  const anon = new Client(ctx.baseUrl);

  // register 201 + cookie + shape, no passwordHash anywhere
  const email = `auth-a-${ctx.mode}@phase11.test`;
  const reg = await register(anon, "Auth User", email, "Auth Org");
  expectStatus(t, "register returns 201", reg, 201);
  check(t, "register sets an HttpOnly auth cookie", reg.setCookies.some((c) => c.startsWith("token=") && /httponly/i.test(c)), reg.setCookies.join(" | "));
  check(t, "register returns user + organization", !!reg.json?.user?.id && reg.json.user.organization?.id, JSON.stringify(reg.json));
  check(t, "register response has no passwordHash", !reg.text.includes("passwordHash"));
  ctx.orgA = reg.json.user.organization.id;
  ctx.A = anon; // reuse this session for the whole mode

  // duplicate email 409
  const dup = await new Client(ctx.baseUrl).post("/api/auth/register", {
    name: "Someone Else",
    email,
    password: "TestPass123!",
  });
  expectStatus(t, "duplicate email returns 409", dup, 409);

  // validation 400s
  const badEmail = await new Client(ctx.baseUrl).post("/api/auth/register", {
    name: "Bad Email",
    email: "not-an-email",
    password: "TestPass123!",
  });
  expectStatus(t, "register with bad email returns 400", badEmail, 400);
  const shortPw = await new Client(ctx.baseUrl).post("/api/auth/register", {
    name: "Short Pw",
    email: `short-${ctx.mode}@phase11.test`,
    password: "short",
  });
  expectStatus(t, "register with short password returns 400", shortPw, 400);
  const shortName = await new Client(ctx.baseUrl).post("/api/auth/register", {
    name: "A",
    email: `shortname-${ctx.mode}@phase11.test`,
    password: "TestPass123!",
  });
  expectStatus(t, "register with 1-char name returns 400", shortName, 400);

  // login 200 + cookie, then /me 200
  const loginClient = new Client(ctx.baseUrl);
  const login = await loginClient.post("/api/auth/login", { email, password: "TestPass123!" });
  expectStatus(t, "login returns 200", login, 200);
  check(t, "login sets an HttpOnly auth cookie", login.setCookies.some((c) => c.startsWith("token=") && /httponly/i.test(c)));
  noPasswordHash(t, "login response has no passwordHash", login);
  const me = await loginClient.get("/api/auth/me");
  expectStatus(t, "/me returns 200 when signed in", me, 200);
  eq(t, "/me returns the registered email", me.json?.user?.email, email);
  noPasswordHash(t, "/me response has no passwordHash", me);

  // wrong password 401 with the generic message; unknown email: same message
  const wrong = await new Client(ctx.baseUrl).post("/api/auth/login", { email, password: "WrongPass999!" });
  expectStatus(t, "wrong password returns 401", wrong, 401);
  eq(t, "wrong password message is generic", wrong.json?.error, "Invalid email or password");
  const unknown = await new Client(ctx.baseUrl).post("/api/auth/login", {
    email: `nobody-${ctx.mode}@phase11.test`,
    password: "WrongPass999!",
  });
  expectStatus(t, "unknown email returns 401", unknown, 401);
  eq(t, "unknown email message matches wrong-password message", unknown.json?.error, "Invalid email or password");

  // login validation 400
  const badLogin = await new Client(ctx.baseUrl).post("/api/auth/login", { email: "bad", password: "x" });
  expectStatus(t, "login with bad email returns 400", badLogin, 400);

  // /me 401 without a cookie
  const meAnon = await new Client(ctx.baseUrl).get("/api/auth/me");
  expectStatus(t, "/me without a cookie returns 401", meAnon, 401);

  // logout clears the cookie (and the cleared session no longer works)
  const logout = await loginClient.post("/api/auth/logout");
  expectStatus(t, "logout returns 200", logout, 200);
  check(
    t,
    "logout clears the token cookie",
    logout.setCookies.some((c) => c.startsWith("token=;") || /Max-Age=0/i.test(c) || /Expires=Thu, 01 Jan 1970/i.test(c)),
    logout.setCookies.join(" | ")
  );
  check(t, "client cookie jar is empty after logout", loginClient.cookie === "");
  const meAfter = await loginClient.get("/api/auth/me");
  expectStatus(t, "/me after logout returns 401", meAfter, 401);

  // org B: a second organisation for cross-org tests (session reused all mode)
  const bClient = new Client(ctx.baseUrl);
  const regB = await register(bClient, "Org B User", `auth-b-${ctx.mode}@phase11.test`, "Org B");
  expectStatus(t, "org B registers 201", regB, 201);
  ctx.B = bClient;
  ctx.orgB = regB.json.user.organization.id;

  // org C: dedicated user for the expensive rate-limit test (no scans yet)
  const cClient = new Client(ctx.baseUrl);
  const regC = await register(cClient, "Rate User", `auth-c-${ctx.mode}@phase11.test`, "Rate Org");
  expectStatus(t, "org C registers 201", regC, 201);
  ctx.C = cClient;

  return t;
}
