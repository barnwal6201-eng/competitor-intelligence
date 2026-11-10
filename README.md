# Competitor Intelligence Scraper & Battlecard Agent

Phases 1–5 of the PRD (v1.1, section 23) are done. Nothing is faked here —
every screen shows real data from the backend.

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
      (dashboard)/competitors/[id]/edit/page.tsx
      (dashboard)/competitors/CompetitorForm.tsx  # shared add/edit form
      (dashboard)/intelligence/page.tsx     # Phase 5: intelligence feed
    components/
      ChangeCard.tsx                    # Phase 5: one detected change card
    middleware.ts           # redirects /dashboard to /login without a token cookie
    services/               # api.ts (health), auth.ts (register/login/logout/me),
                            # competitors.ts (Phase 3 CRUD calls),
                            # scans.ts (Phase 4 scan + snapshots),
                            # changes.ts (Phase 5 changes + feed)
    types/
  backend/
    src/
      config/       # env.ts, db.ts
      models/       # User, Organization, Competitor (Phase 2), Snapshot (Phase 4),
                    # Change (Phase 5)
      controllers/  # authController.ts, competitorController.ts (Phase 3),
                    # scanController.ts (Phase 4), changeController.ts (Phase 5)
      routes/       # health.ts, auth.ts, competitors.ts (Phase 3 + 4 + 5),
                    # changes.ts (Phase 5 feed)
      middleware/   # auth.ts (requireAuth)
      validators/   # auth.ts, competitor.ts (Zod schemas)
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

- No OpenAI analysis, no battlecards — Phase 6 and 7.
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

## Next step: Phase 6

AI analysis — use OpenAI to summarize the detected changes for each
competitor (what changed, why it matters, what a salesperson should do
about it), stored as an analysis record linked to the changes it covers.
