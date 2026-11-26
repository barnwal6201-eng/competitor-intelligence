# Phase 11 — full test suite

Permanent, repeatable backend test suite. One command, from `backend/`:

```bash
npm test
```

That runs `tsx tests/run-all.ts`, which:

1. Starts `mongod` itself if port 27017 is not listening (dbpath
   `~/workspace/tools/mongodb/data`, never `/tmp` — `/tmp` is a 512 MB
   tmpfs and WiredTiger cannot run there). It kills mongod by exact PID
   from the pidfile at the end, **only if it started it**.
2. Builds the backend (`npm run build`).
3. Starts four mock servers on localhost (fake competitor site, mock
   Groq, mock Notion, mock Salesforce — plain `node:http`, no new deps).
4. Runs every area **twice**: first **without Redis** (`REDIS_URL` →
   dead port 6390 — scans must fall back to synchronous and still
   pass), then **with Redis** (a local `redis-server` on 6379, started
   and stopped by the runner, data dir `~/workspace/tools/redis/data`).
   Each mode gets a fresh backend process (ports 5101 / 5102) and a
   freshly dropped test database (`ci-phase11-test`).
5. Prints per-area counts (`auth 12/12`, …) and a final
   `TOTAL x/y`, and exits non-zero on any failure.

If `redis-server` is genuinely unavailable (not in `PATH`, not at the
compiled path `~/workspace/tools/redis/redis-7.4.1/src/redis-server`,
and `apt-get install -y redis-server` fails), the with-Redis mode
prints a clear SKIP with install instructions and the run still exits
0 if the no-Redis mode passed.

## Areas

| Area | What it covers |
|---|---|
| `auth` | register 201 + cookie, duplicate 409, validation 400, login 200, wrong-password 401 (generic message), `/me` 200/401, logout clears cookie, `passwordHash` never in responses |
| `competitors` | CRUD, validation, duplicate website 409 per org (allowed across orgs), search + monitoring filter, cross-org 404s, unauthenticated 401s |
| `scraping` | baseline scan stores snapshots, unchanged page = no new snapshot, changed price = new snapshot, robots-blocked source, per-source outcomes (mock site) |
| `ssrf` | unit probes of `fetchHtml` / `isAllowedByRobots` in fresh `tsx` processes: localhost, 127.0.0.1, 10.x / 172.16.x / 192.168.x, 169.254.169.254, `::ffff:127.0.0.1`, `::ffff:7f00:1`, expanded `::1`, redirect to a private address, robots allow/disallow |
| `changes` | pure detector unit tests (significance rules, identity matching, reorder = no change) + end-to-end changes from the mock rescan, feed + filters |
| `analysis` | mock Groq: stored analysis with all 7 keys + source changes, `{analysis:null}` when covered, 503 with no API key (separate backend pass), invalid JSON / wrong shape / 401 → 502 with nothing saved, `changeIds` validation, cross-org 404, 401 |
| `battlecards` | generate 201 then 409, 400 without snapshots, regenerate bumps version, edit only editable sections (verified-field edit → 400), frozen old versions, cross-org 404, 401 |
| `dashboard` | exact counts, 14-day zero-filled series, 7-day window excluding a 10-day-old change, top-competitor order, price-moves-only, scan health, empty org honest zeros, cross-org isolation |
| `jobs` | Redis mode: POST /scan → 202 + poll to completed, scan-jobs lists, repeatable job present / gone on pause / back on resume / exactly one after frequency change. No-Redis mode: sync fallback (`queued:false`) still writes a ScanJob |
| `integrations` | mock Notion + Salesforce OAuth (bad state → `?error=bad-state`), encrypted token storage (decrypts back, never plain), battlecard + change pushes to both, Salesforce refresh after forced expiry, disconnect blocks pushes, 503 without encryption key / unconfigured, cross-org 404s, 401s |
| `security` | cross-org 404s across every resource type, unauthenticated 401s on every protected route, helmet headers, 413 on oversized JSON, production cookie flags (`SameSite=None` + `Secure`), production without `JWT_SECRET` refuses to start, rate limits (login + expensive, run last) |

## Environment overrides the suite relies on

These are **test-only** and must never be set in production:

| Variable | Meaning |
|---|---|
| `ALLOW_PRIVATE_SCRAPE_URLS=true` | Lets the scrapers fetch the mock site on localhost. The SSRF probes run with it **unset**. |
| `GROQ_API_BASE_URL` | Points the AI client at the mock Groq server (default: the real Groq endpoint). |
| `NOTION_API_BASE_URL` | Points the Notion client at the mock Notion server (default: `https://api.notion.com`). |
| `SALESFORCE_LOGIN_URL` | Points Salesforce OAuth at the mock server (default: `https://login.salesforce.com`). |

The suite also sets `OPENAI_API_KEY=test-groq-key` (the mock ignores it),
`INTEGRATION_ENCRYPTION_KEY` (freshly generated per run), and the mock
OAuth client ids/secrets.

## Rate limits (exact numbers — the suite asserts them)

From `src/middleware/rateLimits.ts` — if a number changes there, update
`tests/security.test.ts` too:

- `loginLimiter`: **30 per 15 min per IP**
- `registerLimiter`: **100 per 15 min per IP**
- `expensiveLimiter`: **30 per 15 min per signed-in user** (scan, analyze,
  Notion/Salesforce push endpoints)

Session discipline: the whole suite shares **one backend process per
mode** and the limiters are in-memory per process, so each mode registers
2 orgs (A and B, plus a dedicated rate-limit user C) **once** and reuses
their sessions everywhere. Total login calls before the login rate test
are 4; user A's expensive calls stay under 30 until the rate tests,
which run last.

## Files

- `run-all.ts` — entry point: mongod/redis/build/mocks, both modes, totals.
- `helpers.ts` — HTTP client with cookie jar, tally helpers, backend
  spawn/wait helpers, `scanAndWait` (202-poll or sync fallback).
- `mocks.ts` — mock site / Groq / Notion / Salesforce servers.
- `ssrf-probe.ts` — subprocess entry for the SSRF unit probes.
- `*.test.ts` — one file per area; each exports `run(ctx)` and returns a
  tally. Shared state (competitor/change/analysis ids) travels on `ctx.state`.
- `run-logs/` — per-run backend stdout/stderr (one file per backend
  process), for debugging failures.

## Sandbox notes

- The redirect-hop SSRF check is covered as far as this sandbox allows:
  the machine has no routable public IP to bind a mock server to, so a
  genuinely public first hop cannot be staged here. The probes prove the
  redirect URL is refused with private checks on, and that the redirect
  loop runs (and fails on the dead private target) with the test override
  on. The hop loop re-validates every hop via `assertPublicUrl` — see
  `src/scrapers/fetcher.ts`.
