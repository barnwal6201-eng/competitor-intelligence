# Competitor Intelligence Scraper & Battlecard Agent

Phases 1–9 of the PRD (v1.1, section 23) are done, plus the Phase 12 full UI
redesign — built before Phases 10/11 at the user's request ("build the whole
ui first"). Nothing is faked here — every screen shows real data from the backend.

- **Phase 1:** project setup and frontend-backend communication.
- **Phase 2:** database models + register/login with bcrypt and HTTP-only cookies
  + protected backend routes and protected frontend routes.
- **Phase 3:** competitor CRUD — add/edit/delete/search/filter competitors,
  all scoped to the signed-in user's organization. Live-tested against a real
  MongoDB: 27 checks passed (create/list/get/update/delete + validation,
  duplicate handling, and cross-organization isolation).
- **Phase 4:** scraping engine — pricing, changelog, careers, and reviews
  scrapers (Axios + Cheerio, with an optional Playwright fallback for
  JavaScript-rendered pages), snapshots stored in MongoDB, manual "Scan now"
  trigger, and a competitor detail page with snapshot history. Live-tested
  against real local test pages and a real MongoDB: 27 checks passed
  (extraction, unchanged-page dedupe, price-change re-snapshot, robots.txt,
  SSRF protection, and cross-organization isolation).
- **Phase 5:** change detection — every new snapshot is compared with the
  previous successful one and meaningful changes are stored as Change records
  (price increases/decreases, plans added/removed, changelog entries added/
  removed, jobs posted/removed, new reviews, with new low-rated reviews
  flagged as negative). A per-competitor changes list, an organization-wide
  intelligence feed at `/intelligence` with significance and source filters,
  and a change count in each scan result. Live-tested against real local test
  pages and a real MongoDB: 53 checks passed (detector unit tests, full scan
  flow, and controller org scoping).

## Stack (PRD sections 2 and 19)

- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS. **No Vite**, as the PRD requires.
- Backend: Express.js + TypeScript, separate from the frontend.
- Database: MongoDB via Mongoose (Atlas in real use).
- Auth: bcryptjs password hashing (pure JavaScript — native `bcrypt` often fails
  to compile on Windows), JWT in an HTTP-only cookie, Zod validation,
  React Hook Form on the frontend.
- Icons: Lucide React.

## Folder structure

```
competitor-intelligence/
  frontend/
    app/
      page.tsx              # Phase 1 setup-check page (real backend health)
      (auth)/login/page.tsx
      (auth)/register/page.tsx
      (dashboard)/dashboard/page.tsx   # protected page, shows current user + org
      (dashboard)/competitors/page.tsx # Phase 3: list/search/filter + delete
      (dashboard)/competitors/new/page.tsx
      (dashboard)/competitors/[id]/page.tsx   # Phase 4: detail + Scan now + snapshots
                                             # Phase 5: + detected changes
                                             # Phase 6: + AI analysis
      (dashboard)/competitors/[id]/edit/page.tsx
      (dashboard)/competitors/CompetitorForm.tsx  # shared add/edit form
      (dashboard)/intelligence/page.tsx     # Phase 5: intelligence feed
    components/
      ChangeCard.tsx                    # Phase 5: one detected change card
    middleware.ts           # redirects /dashboard to /login without a token cookie
    services/               # api.ts (health), auth.ts (register/login/logout/me),
                            # competitors.ts (Phase 3 CRUD calls),
                            # scans.ts (Phase 4 scan + snapshots),
                            # changes.ts (Phase 5 changes + feed),
                            # analysis.ts (Phase 6 analyse + history)
    types/
  backend/
    src/
      config/       # env.ts, db.ts
      models/       # User, Organization, Competitor (Phase 2), Snapshot (Phase 4),
                    # Change (Phase 5), Analysis (Phase 6)
      controllers/  # authController.ts, competitorController.ts (Phase 3),
                    # scanController.ts (Phase 4), changeController.ts (Phase 5),
                    # analysisController.ts (Phase 6)
      routes/       # health.ts, auth.ts, competitors.ts (Phase 3 + 4 + 5 + 6),
                    # changes.ts (Phase 5 feed)
      middleware/   # auth.ts (requireAuth)
      validators/   # auth.ts, competitor.ts (Zod schemas)
      ai/           # Phase 6: openaiClient.ts (transport), analyzer.ts
                    # (prompt + Zod validation of the structured response)
      changes/      # Phase 5: detector (pure snapshot comparison)
      scrapers/     # Phase 4: fetcher (SSRF + robots.txt), pricing, changelog,
                    # careers, reviews scrapers, Playwright fallback, scan runner
                    # (Phase 5: the scan runner stores detected changes)
      utils/        # password.ts, jwt.ts, cookies.ts
      app.ts        # CORS with credentials, routes, 404, central error handler
      server.ts
    .env.example
```

## Prerequisites

- Node.js 18 or newer (verified with Node 24, Next.js 14.2.35).
- **From Phase 2, a MongoDB database is required** — auth cannot work without
  one. Use a free MongoDB Atlas M0 cluster:
  1. Create a free cluster at https://www.mongodb.com/atlas
  2. Database Access: create a database user (username + password).
  3. Network Access: allow your IP (or `0.0.0.0/0` for testing).
  4. Connect > Drivers > copy the connection string.
  5. Paste it as `MONGODB_URI` in `backend/.env`.
- No Redis, OpenAI key, Notion or Salesforce needed yet — those are later phases.

## Run it (Windows, PowerShell — two terminals)

Terminal 1 — backend:

```powershell
cd competitor-intelligence\backend
copy .env.example .env
# Edit .env: paste MONGODB_URI, and set JWT_SECRET (generate one with the
# command in .env.example — never use the dev fallback for real accounts)
npm install
npm run dev
```

You should see:

```
Database: connected — Connected to MongoDB
Backend running at http://localhost:5000
```

Terminal 2 — frontend:

```powershell
cd competitor-intelligence\frontend
npm install
npm run dev
```

Then open http://localhost:3000

## Verify it works

1. Backend health: http://localhost:5000/api/health
   Expected: `{"status":"ok", ... "database":"connected", ...}`
2. Home page at http://localhost:3000 shows **"Backend connected"**.
3. Register: click **Create account**, fill the form, submit.
   You are signed in and taken to **/dashboard**, which shows your name,
   email, role (`owner`) and your organization name.
4. Protected route: sign out, then open http://localhost:3000/dashboard
   directly — you are redirected to **/login**.
5. Wrong password on the login page gives a generic
   "Invalid email or password" (it does not say whether the email exists).

## Auth API (all under /api/auth)

| Method & path | Auth | Result |
|---|---|---|
| POST `/api/auth/register` | — | 201, creates user + organization, sets HTTP-only cookie |
| POST `/api/auth/login` | — | 200, sets HTTP-only cookie |
| POST `/api/auth/logout` | — | 200, clears the cookie |
| GET `/api/auth/me` | required | 200, current user + organization |

Error codes used: 400 validation, 401 not signed in / wrong credentials,
409 email already registered, 503 database not connected.
Passwords are never returned in any response. The `passwordHash` field is
`select: false` in the User model, so even a code mistake cannot leak it
through a normal query.

## Competitors API (all under /api/competitors, Phase 3)

Every endpoint requires a signed-in user, and every query is filtered by
that user's `organizationId` — a competitor from another organization
answers 404, exactly like one that does not exist.

| Method & path | Result |
|---|---|
| GET `/api/competitors` | 200, your organization's competitors, newest first. Optional `?search=` (matches company name or website) and `?monitoring=enabled\|paused` |
| POST `/api/competitors` | 201, creates a competitor in your organization. Required: `companyName`, `websiteUrl`. Optional: `pricingPageUrl`, `changelogUrl`, `careersPageUrl`, `reviewSourceUrl`, `monitoringFrequency` (`hourly`/`daily`/`weekly`, default `daily`), `isMonitoringEnabled` (default `true`) |
| GET `/api/competitors/:id` | 200, one competitor |
| PATCH `/api/competitors/:id` | 200, updates only the fields sent. Clearing an optional URL removes it |
| DELETE `/api/competitors/:id` | 200, deletes the competitor |

Error codes used: 400 validation / nothing to update, 401 not signed in,
404 competitor not found (including other organizations' competitors),
409 a competitor with this website is already monitored in your
organization (the website is unique per organization, not globally),
503 database not connected.

## Verify Phase 3 works

1. Sign in, open http://localhost:3000/competitors — the list is empty at first.
2. Click **+ Add competitor**, fill in a company name and website, save.
   It appears in the list with its monitoring frequency.
3. Use the search box and the All / Monitoring / Paused filter.
4. Click **Edit**, change the name or pause monitoring, save.
5. Click **Delete**, confirm — it disappears from the list.
6. Sign out, open http://localhost:3000/competitors directly — you are
   redirected to **/login**.

## Troubleshooting

| Problem | Fix |
|---|---|
| Frontend says "Backend not reachable" | Backend terminal must be running (`npm run dev` in `backend`). Check http://localhost:5000/api/health first. |
| `/api/auth` returns 503 "Database not connected" | `MONGODB_URI` is missing or wrong in `backend/.env`. Restart the backend after editing `.env` — it reads the file only at startup. |
| Register/login fails with an Atlas error | Check the Atlas username/password in the URI, and Network Access (your IP must be allowed). The backend terminal prints the real connection error. |
| Dashboard keeps redirecting to /login | The login cookie was not set — make sure the frontend is on http://localhost:3000 and the backend `FRONTEND_URL` matches it. Do not open the frontend on 127.0.0.1 while the backend expects localhost. |
| Port 5000 or 3000 already in use | Find it with `netstat -ano \| findstr :5000` (Windows) and stop that process, or change `PORT` in `backend/.env` and `NEXT_PUBLIC_API_URL` in `frontend/.env.local` together. |
| `cookies(...) is not a function` in `app/(dashboard)/layout.tsx` | Your machine is running Next.js 15/16, but this project was written for Next.js 14. In 15+, `cookies()` returns a Promise and must be awaited. Fix: make `DashboardLayout` async and use `const cookieStore = await cookies()` (this works on Next 14 too). The competitor detail/edit pages use `useParams()` instead of the `params` prop for the same reason. If you would rather go back to Next 14, delete `frontend/node_modules` and run `npm ci` in `frontend` — the lockfile pins Next 14.2.35. |
| `npm install` fails | Delete `node_modules` and `package-lock.json` in that folder only, then run `npm install` again. |

## Scanning API (Phase 4)

| Method & path | Result |
|---|---|
| POST `/api/competitors/:id/scan` | 200, scans the competitor's pages now and returns a per-source summary: `created` (new snapshot stored), `unchanged` (page identical to the last snapshot, not stored again), `failed`, or `blocked` (robots.txt) |
| GET `/api/competitors/:id/snapshots` | 200, snapshot history for the competitor, newest first. Optional `?type=pricing\|changelog\|careers\|reviews` and `?limit=` (default 20, max 100) |

How a scan works: the pricing page is used for pricing (falling back to the
main website when no pricing URL is set); changelog, careers, and reviews
run only when their URL is set. Each page is fetched with Axios and parsed
with Cheerio. Pages are normalized to text and hashed (SHA-256) — an
unchanged page produces no new snapshot, which is exactly what change
detection (Phase 5) compares against.
- **Phase 6:** AI analysis — OpenAI (gpt-4o-mini by default) analyses the
  newest unanalysed changes and returns structured JSON: summary,
  implications, strengths, weaknesses, suggested sales responses, talking
  points, and a confidence indicator. Responses are validated with Zod
  before saving; the prompt forbids inventing facts; every analysis stores
  the source changes it was based on and the UI labels it AI-generated.
  Manual trigger only (each run costs API credits); without an
  OPENAI_API_KEY the app keeps working and analysis returns 503 with setup
  instructions. Live-tested with a stubbed OpenAI client and a real
  MongoDB: 45 checks passed (prompt, schema validation, client errors,
  controller org scoping, no-key behaviour).

Safety rules (PRD sections 9 and 20): only public http(s) URLs are fetched.
Private addresses (localhost, private LAN ranges, cloud metadata
169.254.169.254) are refused — SSRF protection — and DNS-resolved addresses
are checked too, so a hostname resolving to a private IP is also refused.
`robots.txt` is respected per origin (cached 1 hour): a disallowed page is
recorded as `blocked`, not fetched. Requests carry a bot User-Agent,
a 10-second timeout, and a 5 MB size cap.

JavaScript-rendered pages: if the static HTML has almost no text, the
fetcher can fall back to Playwright — but only when Playwright is installed
and `SCRAPER_USE_PLAYWRIGHT=true` is set in `backend/.env`. To enable it:

```powershell
npm install playwright
npx playwright install chromium
```

## Verify Phase 4 works

1. Sign in, open a competitor (Competitors → View), and press **Scan now**.
   Each configured page reports `New snapshot` (or `Blocked` / `Failed` with
   a reason), and the snapshot history below fills in with what was found —
   plans and prices, changelog entries, job listings, or reviews.
2. Press **Scan now** again without changing anything — every source reports
   `Unchanged` and no new snapshots appear.
3. Change something on a competitor's pricing page, scan again — only the
   pricing source reports `New snapshot`, with the new price in its summary.

## Change detection API (Phase 5)

| Method & path | Result |
|---|---|
| GET `/api/competitors/:id/changes` | 200, detected changes for the competitor, newest first. Optional `?type=pricing\|changelog\|careers\|reviews`, `?significance=high\|medium\|low`, and `?limit=` (default 20, max 100) |
| GET `/api/changes` | 200, the intelligence feed — detected changes across every competitor in the signed-in user's organization, newest first, each with its competitor's name. Same optional `?type=`, `?significance=`, `?limit=` |

How detection works: when a scan stores a new snapshot, it is compared
with the previous *successful* snapshot of the same source type (a failed
or blocked snapshot has no data to compare against). Matching is by stable
identity, not list position — plan name, changelog title, job title +
location, review text — so a reordered page does not look like a change.
The first scan is a baseline and produces no changes; an unchanged page
produces no new snapshot, so it produces no changes either.

Significance is a fixed rule, not a guess: a price increase, a removed
plan, and a new negative review (rating 2 or below) are **high**; a price
decrease, a new plan, and a new changelog entry are **medium**; a new job,
a removed job, a removed changelog entry, and a new ordinary review are
**low**. Only a price *number* changing counts as a price move.

## Verify Phase 5 works

1. Sign in, open a competitor, and press **Scan now** twice. The first scan
   sets the baseline — no changes. The second scan, with nothing changed on
   the pages, also reports no changes.
2. Change something on a competitor's page — a price, a new changelog entry,
   a new job, a new review — and scan again. The scan result now shows
   e.g. "Pricing: New snapshot — 2 changes detected", and the
   **Detected changes** section on the competitor page lists them with
   old → new values.
3. Open **Intelligence feed** from the dashboard — the same changes appear
   there across all competitors. Filter by **High** to see only the
   price increases, removed plans, and negative reviews.

## What is NOT done yet (deliberately)

- No battlecards yet — Phase 7 generates them from the analyses.
- No dashboard charts, no Redis/BullMQ jobs, no Notion/Salesforce — Phase 8–10.

## How to explain Phase 2 in an internship review

- "Registering creates both a User and an Organization. The first user is the
  organization owner, and every later record is isolated by `organizationId`."
- "Passwords are hashed with bcryptjs. The hash is `select: false`, so it is
  never returned by accident."
- "Login sets a JWT in an HTTP-only cookie — JavaScript cannot read it, so a
  cross-site script cannot steal the token."
- "Protected routes check the token twice: Next.js middleware/layout checks
  the cookie is present, and the backend `requireAuth` middleware verifies
  the token and reloads the user from the database."
- "CORS allows only the frontend origin, with `credentials: true`, so the
  cookie travels from the frontend to the API."

## How to explain Phase 3 in an internship review

- "Every competitor query filters by `organizationId`, so organizations can
  never see each other's data — a cross-organization request gets the same
  404 as a missing record, so it does not even leak that the record exists."
- "The website is unique per organization, not globally — two different
  companies can both track Asana, but one organization cannot add it twice."
- "Validation runs twice: Zod on the frontend form for instant feedback, and
  Zod + Mongoose validators on the backend, because the frontend can never
  be trusted on its own."
- "Clearing an optional URL on edit removes the field with `$unset`, instead
  of leaving the old value in place."

## How to explain Phase 4 in an internship review

- "Each source has its own scraper — pricing, changelog, careers, reviews —
  but they share one fetcher, so SSRF protection and robots.txt are enforced
  in exactly one place instead of four."
- "Scrapers never assume a site's HTML layout: the pricing scraper looks for
  price-like text and the nearest heading, so it works on unfamiliar pages
  and degrades to reporting the prices it found instead of crashing."
- "Every snapshot is hashed. An unchanged page is not stored again — that
  hash comparison is what Phase 5's change detection is built on."
- "The scan runs synchronously in the API request in this phase; Phase 9
  moves it into Redis + BullMQ background jobs, as the PRD requires."

## How to explain Phase 5 in an internship review

- "Change detection is a pure function: it takes the previous snapshot's
  extracted data and the new snapshot's, and returns a list of changes.
  No database, no network — so it is unit-testable on its own."
- "Matching is by identity, not by position: a plan is matched by its name,
  a job by title plus location, a review by its text. A page that only
  reordered its items reports no change."
- "The first scan is a baseline, so it reports zero changes, and an
  unchanged page is never stored, so it can never report a change either."
- "Significance is a fixed rule — price increase, removed plan, and negative
  review are high — because a rule is explainable; Phase 6 adds AI judgment
  on top of it instead of replacing it."

## AI analysis API (Phase 6)

| Method & path | Result |
|---|---|
| POST `/api/competitors/:id/analyze` | 200, runs OpenAI over the competitor's newest unanalysed changes (max 20) and stores the structured analysis. Body: optional `{ changeIds: [...] }` to analyse exactly those changes. Returns `{ analysis: null, message }` when everything is already analysed. 503 when no `OPENAI_API_KEY` is set, 502 when OpenAI errors or returns an invalid response |
| GET `/api/competitors/:id/analyses` | 200, analysis history for the competitor, newest first. Optional `?limit=` (default 10, max 50) |
| GET `/api/competitors/:id/analyses/:analysisId` | 200, one analysis |

How analysis works: the prompt lists the detected changes — category,
significance, title, old → new values, source URL — and nothing else, and
instructs the model to use only those facts and never invent prices,
features, dates, or quotes. The model must return JSON with exactly these
keys: `summary`, `implications`, `strengths`, `weaknesses`,
`suggestedResponses`, `talkingPoints`, `confidence` (high/medium/low).
The response is validated with Zod before anything is saved; a bad
response is a 502 and nothing is stored. Each analysis records the model
used (`gpt-4o-mini` by default, `OPENAI_MODEL` overrides it) and the token
usage, plus the source changes it was based on, so the summary can always
be checked against the real changes.

Setup: get a key at https://platform.openai.com/api-keys, add
`OPENAI_API_KEY=...` to `backend/.env`, restart the backend. Note that a
ChatGPT subscription does not include API credits — the API needs its own
billing on the same OpenAI account. Analysis is a manual button press,
not automatic after a scan, because each run costs API credits.

## Verify Phase 6 works

1. Add `OPENAI_API_KEY` to `backend/.env` and restart the backend.
   Without the key, pressing **Analyse latest changes** shows a clear
   setup message instead of crashing.
2. Open a competitor with detected changes (scan, change a page, scan
   again) and press **Analyse latest changes**. After a few seconds the
   analysis appears: a summary, what it could mean, strengths,
   weaknesses, suggested responses, and talking points, with a confidence
   badge and the list of changes it was based on.
3. Press it again with no new changes — it reports that everything is
   already analysed instead of spending credits twice.
4. Earlier analyses stay listed under “Previous analyses” — click one to
   read it again.

## How to explain Phase 6 in an internship review

- "The AI only ever sees the detected changes — the prompt lists them and
  nothing else, and tells the model never to invent a price, a feature, or
  a date that is not in the list."
- "The model must return structured JSON, and the backend validates it
  with Zod before saving. A response in the wrong shape is rejected, not
  stored half-broken."
- "Verified facts and AI interpretation stay separate: the analysis stores
  the source changes next to the AI text, and the UI labels the whole
  thing AI-generated so nobody mistakes it for scraped data."
- "Analysis is manual because it costs money — each run uses OpenAI
  credits, so the user decides when to spend them. Phase 9 automates it
  as a background job."

## Phase 7: Battlecards (sales-ready pages per competitor)

A battlecard is a one-page summary a salesperson reads before a call,
built only from data the system already holds — never typed up by hand,
never invented (PRD section 12). Open **Battlecards** from the dashboard
or a competitor's page, and press **Generate** (needs at least one scan
first).

**What's on it, in order:** overview, positioning, pricing (plans from
the latest pricing snapshot, with the source URL and capture date),
product features (latest changelog entries), strengths, weaknesses,
recent changes, customer complaints (reviews rated 2 or below),
talking points, objection handling, sources, and the last-updated date.

**Verified vs AI — kept apart on purpose.** Pricing, features, recent
changes, complaints, and sources are verified data from scans. They are
read-only on the battlecard: the only way they change is a new scan and
**Regenerate**. Strengths, weaknesses, talking points, objection
handling, and the positioning line come from the latest AI analysis
(Phase 6) and are labelled **AI-generated** on the page. If no analysis
exists yet, those sections stay empty with a note to run **Analyse
latest changes** first, then Regenerate — the battlecard never fills
them in from nothing.

**Edit, versions, PDF.** **Edit** changes only the AI-written sections
(overview, positioning, strengths, weaknesses, talking points,
objection handling). Every generate, regenerate, and edit bumps the
version number and freezes the previous content, so **Previous
versions** always shows exactly what the battlecard said at the time.
**Print / PDF** opens the browser print dialog — choose "Save as PDF"
there; the buttons and navigation are hidden from the printout.

**Endpoints:** `POST /api/competitors/:id/battlecard/generate` (409 if
one already exists), `POST /:id/battlecard/regenerate`,
`PUT /:id/battlecard` (editable sections only — pricing and the other
verified sections are rejected with a 400),
`GET /:id/battlecard`, `GET /:id/battlecard/versions`,
`GET /:id/battlecard/versions/:version`, and `GET /api/battlecards`
(the organization-wide list). All of them require sign-in and are
scoped to the user's organization — another organization's battlecard
is a 404, not a leak.

**Live-tested 2026-11-11: 42/42 checks passed** (composer unit checks:
exact plans/features/complaints/AI sections, empty AI sections with no
analysis; HTTP: generate 201 then 409, edit → v2 with the old version
frozen, regenerate → v3 picking up a new change, verified fields not
editable, cross-org 404, unauthenticated 401).

## How to explain Phase 7 in an internship review

- "A battlecard is assembled from data we already verified — snapshots,
  detected changes, and the last AI analysis. Nothing on it is typed in
  or invented."
- "Verified sections are read-only. If sales wants the pricing line to
  change, they rescan — they can't type a fake price into the card."
- "Every save is a new version and the old one is frozen, so you can
  always prove what the battlecard said on the day of a call."

## Next step: Phase 8

Full dashboard and analytics — the home page becomes a real overview
(changes over time, most active competitors, price-move counts) instead
of the minimal placeholder it is now.

## Phase 8: Dashboard and analytics (the home page, finished)

The dashboard is no longer a status page — it is a real overview of the
workspace, and every number on it is a live count over the signed-in
user's own data (PRD section 24, MVP). Nothing is faked or sampled: an
empty workspace honestly shows zeros and empty states.

**What's on it:**

- **Stat cards** — competitors (monitoring vs paused), changes in the
  last 7 days (with totals), high-priority changes in the last 7 days
  (price rises, removed plans, bad reviews), battlecards and AI analyses.
- **Changes over time** — a 14-day bar chart of detected changes per
  day, built with plain divs (no chart library). Quiet days show zero.
- **Most active competitors** — ranked by detected-change count, with
  the latest change date, linking to each competitor.
- **Recent price moves** — the newest price increases and decreases.
- **Recent activity** — the 8 newest changes, with a link to the full
  intelligence feed.
- **Scan health** — per competitor: monitoring on/paused, when it was
  last scanned, whether the last scan succeeded, failed, or was blocked,
  and how many snapshots it has.

**Endpoint:** `GET /api/dashboard/overview` — one call returning stats,
the 14-day series, top competitors, price moves, recent changes, and
scan health. It requires sign-in and is scoped to the user's
organization (another organization's data never appears).

**Live-tested 2026-11-11: 28/28 checks passed** (exact counts, 14-day
buckets including zero days, 7-day windows excluding a 10-day-old
change, top-competitor order, price-moves-only list, scan-health
statuses, cross-org isolation, an empty organization returning honest
zeros, unauthenticated 401).

## How to explain Phase 8 in an internship review

- "The dashboard is one aggregation endpoint. Every card and chart on
  the page is a MongoDB count or group-by over the user's own data —
  there is no mock data anywhere in the app."
- "The 14-day chart fills quiet days with zero instead of hiding them,
  so a flat week reads as a flat week, not as missing data."

## Phase 9: Background jobs with Redis + BullMQ (finished)

Scans no longer run inside the API request. Pressing **Scan now**
enqueues a job on the `scan-queue` (BullMQ, backed by Redis); a worker
picks it up, runs the Phase 4 scanner (which also does Phase 5 change
detection), and records the outcome. Scheduled scans run on their own:
one repeatable job per monitored competitor, repeating every hour /
day / week from that competitor's `monitoringFrequency`.

**What was built:**

- **Queue** (`backend/src/queues/scanQueue.ts`) — `enqueueScan`,
  `scheduleCompetitor`, `unscheduleCompetitor`, `resyncSchedules`.
  Manual scans are de-duplicated: if a scan for the same competitor
  is already queued or running, the existing job is returned instead
  of a second one. Jobs retry 3 times with exponential backoff.
- **Worker** (`backend/src/workers/scanWorker.ts`, entry
  `backend/src/worker.ts`, `npm run worker`) — loads the competitor
  fresh from MongoDB (org-scoped), scans it, updates the ScanJob
  record and the competitor's `lastScannedAt` / `lastScanStatus`.
  In development the API process also runs the worker
  (`SCAN_WORKER_IN_PROCESS=true`, the default), so one `npm run dev`
  is enough; in production set it to `false` and run `npm run worker`
  in a separate process.
- **ScanJob model** (`backend/src/models/ScanJob.ts`) — the durable
  audit trail in MongoDB (Redis is volatile): trigger
  (`manual` | `scheduled`), status
  (`queued` | `active` | `completed` | `failed`), scan summary or
  error, attempts, queued/started/finished times. The worker creates
  the record for scheduled runs too (repeatable jobs bypass the
  enqueue endpoint), so the scan-jobs list shows every run, manual
  or scheduled.
- **Endpoints** — `POST /api/competitors/:id/scan` now returns **202**
  with `{ queued: true, jobId, scanJobId }`; `GET /api/jobs/:jobId`
  and `GET /api/jobs` (org-scoped, with live queue counts and Redis
  status); `GET /api/competitors/:id/scan-jobs` (recent jobs for one
  competitor). `GET /api/health` now also reports Redis status.
- **Scheduling rules** — creating a competitor schedules its
  repeatable job; changing its frequency or pausing it re-creates /
  removes the job; deleting it removes the job; server/worker startup
  re-syncs all schedules. Pausing stops *scheduled* scans only —
  a manual Scan now still works.
- **Frontend** — the competitor detail page polls the job until it
  completes or fails (2-minute timeout), then reloads snapshots and
  changes; it shows the schedule (frequency, paused/on, last scanned)
  and a Recent scan jobs list. `services/jobs.ts` is new.

**Graceful degradation (deliberate):** Redis is optional. If it is
down, the app still starts, `/api/health` reports Redis disconnected,
scheduled scans are paused, and a manual scan runs synchronously in
the request (Phase 4 behaviour) and still writes a ScanJob record.
Nothing hard-fails for lack of Redis. Queue calls time out after 5
seconds, so a dead Redis makes a scan fall back in seconds instead of
hanging the request forever (BullMQ's connections retry indefinitely
on their own).

**What is NOT in Phase 9:** automatic AI analysis after each scan
(analysis stays manual, Phase 6 — it costs Groq/OpenAI credits on
every run), and notifications (no email/Slack alerts yet). Those are
not part of this phase.

**Run it:** install Redis and start it (`redis-server`, port 6379),
set `REDIS_URL` in `backend/.env` (see `.env.example`), then
`npm run dev` in `backend/` (worker runs in-process) and `npm run dev`
in `frontend/`. For a separate worker: set
`SCAN_WORKER_IN_PROCESS=false` on the API server and run
`npm run worker` in a third terminal.

## How to explain Phase 9 in an internship review

- "The API never scrapes a page directly any more — it enqueues a
  BullMQ job and returns 202, and a worker does the scan. That is
  what lets the same code run scheduled scans every hour without
  anyone pressing a button."
- "Redis is a cache/queue, not the source of truth: every job also
  has a ScanJob record in MongoDB, so the history survives a Redis
  restart, and if Redis is down the scan falls back to running
  synchronously instead of failing."
- "A repeatable job is created per competitor from its
  monitoringFrequency, and changing the frequency or pausing removes
  and re-creates it — so a competitor can never have two schedules."

## Phase 12: Full UI redesign (finished)

Every page rebuilt with one consistent design system — sidebar navigation
(Dashboard / Competitors / Intelligence / Battlecards), workspace + user in
the sidebar footer, shared cards, badges, buttons, and empty states
(`frontend/components/ui.tsx`, `frontend/components/AppShell.tsx`). Indigo
accent kept throughout; no new dependencies (Lucide icons, Tailwind, plain
divs — the 14-day chart is still div-based, no chart library).

- **App shell** — fixed sidebar on desktop, compact top bar with pill nav
  on mobile. The dashboard layout still guards with `await cookies()`
  (Next.js 16 fix) and the detail/edit pages still use `useParams()`.
- **Dashboard** — same Phase 8 sections (stat cards with icons, 14-day
  chart, most-active competitors, price moves, recent activity, scan
  health), restyled; sign-out moved into the sidebar.
- **Competitors** — card grid with monitoring badges, watched-pages count,
  and View/Edit/Delete; the form is grouped (Company / Pages to watch /
  Monitoring). Detail page is two-column: pages watched, Scan now, and
  detected changes on the left; recent scan jobs and AI analysis on the
  right; snapshot history below.
- **Intelligence feed** — significance and source filters in a card, change
  cards with a significance accent border and old → new value chips.
- **Battlecards** — list with Generated/Not generated status; detail with
  Generate/Regenerate/Edit/Print-PDF, version viewing, and the 12 PRD
  sections restyled (AI sections keep their AI-generated badge).
- **Auth + landing** — brand panel on sign-in/register; the home page is a
  real landing page that still shows the live backend health check.
- No backend logic changed in this phase. All numbers still come from the
  real API; empty states stay honest.

## Next step: Phase 10

Notion / Salesforce integrations — push battlecards and detected
changes into the tools sales teams already use, so the intelligence
leaves this app instead of living only inside it.
