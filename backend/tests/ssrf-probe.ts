// Phase 11 — SSRF probe subprocess.
// Run with tsx in its OWN process so ALLOW_PRIVATE_SCRAPE_URLS can be
// set/unset per probe (the fetcher reads it at call time, but the
// robots cache is module-level, so a fresh process is the clean split).
//   npx tsx tests/ssrf-probe.ts fetch <url>
//   npx tsx tests/ssrf-probe.ts robots <url>
// Prints one JSON line: { ok, ... } / { ok:false, error }.
// Always exits 0 — the caller (ssrf.test.ts) decides pass/fail.
import { fetchHtml, isAllowedByRobots } from "../src/scrapers/fetcher";

async function main(): Promise<void> {
  const kind = process.argv[2];
  const url = process.argv[3];
  try {
    if (kind === "fetch") {
      const html = await fetchHtml(url);
      console.log(JSON.stringify({ ok: true, len: html.length }));
    } else if (kind === "robots") {
      const allowed = await isAllowedByRobots(new URL(url));
      console.log(JSON.stringify({ ok: true, allowed }));
    } else {
      console.log(JSON.stringify({ ok: false, error: `unknown probe kind: ${kind}` }));
    }
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
}

main();
