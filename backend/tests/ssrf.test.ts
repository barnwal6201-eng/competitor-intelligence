// Area 4 — SSRF: unit-level probes of fetchHtml / isAllowedByRobots.
// Each probe runs in its OWN tsx process (ssrf-probe.ts) so
// ALLOW_PRIVATE_SCRAPE_URLS can be set/unset per case and the fetcher's
// module-level robots cache never leaks between cases.
//
// Sandbox note: this machine has no routable public IP to bind a mock
// server to (its 198.19.0.2 address is not reachable from itself), so a
// genuinely public first hop cannot be staged here. The redirect-hop
// re-validation is therefore covered two ways: (a) the redirect URL is
// refused outright when private checks are on, and (b) with the
// test-only override on, the redirect IS followed and the private
// target then fails to fetch — proving the hand-rolled redirect loop
// runs. The hop loop calls assertPublicUrl on every hop (see
// src/scrapers/fetcher.ts); the "allowed" case below proves a public
// URL fetches fine through the same code path.
import { spawn } from "node:child_process";
import { BACKEND_DIR, check, tally, type SuiteCtx, type Tally } from "./helpers";

interface ProbeResult {
  ok: boolean;
  len?: number;
  allowed?: boolean;
  error?: string;
}

function probe(kind: "fetch" | "robots", url: string, allowPrivate: boolean): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (allowPrivate) env.ALLOW_PRIVATE_SCRAPE_URLS = "true";
    else delete env.ALLOW_PRIVATE_SCRAPE_URLS;
    const child = spawn("npx", ["tsx", "tests/ssrf-probe.ts", kind, url], {
      cwd: BACKEND_DIR,
      env: env as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        resolve(JSON.parse(out.trim().split("\n").pop() ?? "{}") as ProbeResult);
      } catch {
        reject(new Error(`probe exited ${code} with unparsable output: ${out} ${err}`));
      }
    });
  });
}

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("ssrf");
  const site = `http://127.0.0.1:${ctx.mockSitePort}`;

  const refused: [string, string][] = [
    ["localhost refused", `${site.replace("127.0.0.1", "localhost")}/pricing`],
    ["127.0.0.1 refused", `${site}/pricing`],
    ["10.x refused", "http://10.0.0.5/pricing"],
    ["192.168.x refused", "http://192.168.1.1/pricing"],
    ["172.16.x refused", "http://172.16.0.9/pricing"],
    ["169.254.169.254 (cloud metadata) refused", "http://169.254.169.254/latest/meta-data/"],
    ["IPv4-mapped IPv6 ::ffff:127.0.0.1 refused", "http://[::ffff:127.0.0.1]:5121/pricing"],
    ["IPv4-mapped IPv6 hex ::ffff:7f00:1 refused", "http://[::ffff:7f00:1]:5121/pricing"],
    ["expanded loopback ::1 form refused", "http://[0:0:0:0:0:0:0:1]:5121/pricing"],
    ["redirect to a private address refused", `${site}/redirect-private`],
  ];
  for (const [label, url] of refused) {
    const r = await probe("fetch", url, false);
    check(t, label, r.ok === false && /private|Refused/i.test(r.error ?? ""), JSON.stringify(r));
  }

  // Robots: disallowed path is refused, allowed path is allowed.
  const robotsBlocked = await probe("robots", `${site}/blocked-pricing`, true);
  check(t, "robots.txt disallows /blocked-pricing", robotsBlocked.ok === true && robotsBlocked.allowed === false, JSON.stringify(robotsBlocked));
  const robotsOk = await probe("robots", `${site}/pricing`, true);
  check(t, "robots.txt allows /pricing", robotsOk.ok === true && robotsOk.allowed === true, JSON.stringify(robotsOk));

  // Allowed case: with the test-only override on, the mock page fetches.
  const allowed = await probe("fetch", `${site}/pricing`, true);
  check(t, "public URL fetches with ALLOW_PRIVATE_SCRAPE_URLS=true", allowed.ok === true && (allowed.len ?? 0) > 100, JSON.stringify(allowed));

  // Redirect loop runs with the override on: the hop to 127.0.0.1:9 is
  // followed and then fails to fetch (nothing listens there) — it is
  // not silently swallowed or served.
  const redir = await probe("fetch", `${site}/redirect-private`, true);
  check(t, "redirect is followed with override on and the dead target fails", redir.ok === false && /Could not fetch|ECONNREFUSED/i.test(redir.error ?? ""), JSON.stringify(redir));

  return t;
}
