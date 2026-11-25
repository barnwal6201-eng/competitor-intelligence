# Deployment Guide — Competitor Intelligence SaaS

Production stack: **MongoDB Atlas** (database) + **Render** (Next.js
frontend + API + scan worker + Redis). Everything below is free tier. **You do the deploying** — this guide is steps only; nothing here
creates an account or deploys anything by itself.

Architecture once deployed:

```
Browser ──► Render (Next.js frontend, NEXT_PUBLIC_API_URL)
                │
                ▼  (cookie auth, CORS allow-listed by FRONTEND_URL)
Render web service ──► MongoDB Atlas (MONGODB_URI)
  competitor-intelligence-api        │
  (node dist/server.js)              ▼
Render background worker ──► Redis Key Value (REDIS_URL, BullMQ queue)
  competitor-intelligence-worker
  (node dist/worker.js)
```

## 0. What you need before starting

| Account / thing | Why | Cost |
|---|---|---|
| MongoDB Atlas account | Database (free M0 cluster) | Free |
| Render account | API web service + worker + Redis | Free tier |
| Groq account (optional) | AI analysis only — get a key at https://console.groq.com | Free |
| Notion / Salesforce accounts (optional) | Integrations only — skip if you don't use them | Free (Notion free plan; Salesforce free Developer Edition org) |
| This repo pushed to GitHub | Render deploys from a connected Git repo | — |

No account is created for you. Create each one yourself, then follow the
steps in order: Atlas → Render Blueprint → point them at each other (step 3).

## 1. MongoDB Atlas — free M0 cluster

1. Go to https://www.mongodb.com/atlas and create a free account, then
   **Create a cluster** → choose the **M0 (Free)** tier. Any region close
   to you is fine; the defaults are fine.
2. **Database Access** (left sidebar) → **Add New Database User**:
   username + a strong password. Save the password somewhere safe —
   it goes into the connection string. Give the user **Read and write to
   any database** (Atlas's built-in "readWriteAnyDatabase" role is fine).
3. **Network Access** → **Add IP Address** → **Allow Access from
   Anywhere** (`0.0.0.0/0`). Render does not give your services a fixed
   outbound IP on the free tier, so IP allow-listing a single address
   will not work — `0.0.0.0/0` is required. Access is still protected by
   the database username/password.
4. **Database** (Clusters) → **Connect** → **Drivers** → copy the
   connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Replace `<username>` and `<password>` with the user from step 2.
   (URL-encode the password if it contains special characters like `@`,
   `/`, `:` or `#`.) Keep this string — it is `MONGODB_URI` in step 2.
   You do not need to name a database in the string; Mongoose uses the
   default database.

## 2. Backend on Render — API + worker + Redis (Blueprint)

The repo contains `render.yaml` at the project root: a Render Blueprint
that creates all four services at once. It contains **no
secrets** — every secret is declared `sync: false`, so Render asks you
for the value in the dashboard.

1. Push the repo to GitHub (Render deploys from a connected repo).
2. Render dashboard → **New → Blueprint** → connect the GitHub repo.
   Render reads `render.yaml` and shows the four services it will
   create: `competitor-intelligence-frontend` (web),
   `competitor-intelligence-api` (web), `competitor-intelligence-worker`
   (background worker), and `competitor-intelligence-redis` (Key Value).
3. Fill in the prompted secrets (see the table below). Leave
   `FRONTEND_URL` as its pre-filled value for now — you will correct it
   in step 3 if the dashboard shows a different frontend URL.
4. Click **Apply**. Render builds `backend/` (`npm install && npm run build`)
   and `frontend/` (`npm install && npm run build`) and starts the API,
   the worker and the frontend. First build takes a few minutes.
5. Check it worked: open
   `https://competitor-intelligence-api.onrender.com/api/health`
   (your service's URL is shown in the Render dashboard — the exact
   subdomain may differ). Expected response:
   ```json
   {"status":"ok","service":"competitor-intelligence-backend",
    "database":"connected","redis":"connected", ...}
   ```
   `database` must say `connected` (otherwise see Troubleshooting).
   `redis` should say `connected`; if it says `disconnected`, scans
   still work (they run synchronously) — check the Redis service in
   the dashboard.

### Backend environment variables

Set on the Render dashboard (Environment tab of each service). The
Blueprint pre-fills everything except the secrets, which it prompts
for. This table is the full list — it matches `backend/.env.example`.

| Variable | Required? | Where to get it / value |
|---|---|---|
| `NODE_ENV` | Yes | `production` (pre-filled by the Blueprint) |
| `PORT` | No | **Do not set.** Render injects `PORT` automatically; the backend listens on it. |
| `MONGODB_URI` | **Yes** | Atlas connection string from step 1. |
| `JWT_SECRET` | **Yes** | Generate a long random value — run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` on your machine and paste the output. The backend **refuses to start in production without it** (no fallback). Never reuse the dev fallback. |
| `FRONTEND_URL` | **Yes** | Your deployed frontend URL, e.g. `https://competitor-intelligence-frontend.onrender.com` (no trailing slash). Pre-filled by the Blueprint — correct it after step 3 if the dashboard shows a different URL, then redeploy the API. CORS blocks the frontend until this matches exactly. |
| `REDIS_URL` | Recommended | Wired automatically from the `competitor-intelligence-redis` service by the Blueprint (`fromService`). Do not type it by hand. Optional in the sense that the app starts without Redis — but without it there are no background/scheduled scans. |
| `SCAN_WORKER_IN_PROCESS` | Yes | `false` (pre-filled). The API must not run the worker in-process in production — the separate worker service does it. |
| `SCAN_WORKER_CONCURRENCY` | No | `2` (pre-filled) — how many scans the worker runs at once. |
| `OPENAI_API_KEY` | Optional | Groq API key from https://console.groq.com → API Keys. Free. Despite the name, this holds the **Groq** key (the code was written for OpenAI first). Without it the app works fine; only **Analyse latest changes** returns 503. |
| `OPENAI_MODEL` | No | `openai/gpt-oss-120b` (pre-filled) — the Groq model used for analysis. |
| `INTEGRATION_ENCRYPTION_KEY` | Optional | Only needed for Notion/Salesforce. A 64-character hex key (32 random bytes): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. If it ever changes, stored integration tokens can no longer be decrypted — disconnect and reconnect the integrations. |
| `NOTION_CLIENT_ID` | Optional | Notion integration OAuth client ID (see step 6). |
| `NOTION_CLIENT_SECRET` | Optional | Notion integration OAuth client secret. |
| `NOTION_REDIRECT_URI` | Optional | `https://<your-render-api>.onrender.com/api/integrations/notion/callback` — the **public** backend URL, not localhost. |
| `SALESFORCE_CLIENT_ID` | Optional | Salesforce Connected App Consumer Key (see step 6). |
| `SALESFORCE_CLIENT_SECRET` | Optional | Salesforce Connected App Consumer Secret. |
| `SALESFORCE_REDIRECT_URI` | Optional | `https://<your-render-api>.onrender.com/api/integrations/salesforce/callback` — the **public** backend URL, not localhost. |
| `SALESFORCE_LOGIN_URL` | No | `https://login.salesforce.com` (pre-filled). Use `https://test.salesforce.com` only for a Salesforce sandbox org. |

The worker service needs the same variables (the Blueprint sets them
on both Node services). It needs `MONGODB_URI` and `REDIS_URL` to run —
without Redis it exits at startup, because a worker with no queue has
nothing to do; without MongoDB it also exits. The API, by contrast,
starts without Redis and falls back to synchronous scans.

## 3. Frontend on Render (same Blueprint — nothing extra to deploy)

The frontend is the fourth service in `render.yaml`
(`competitor-intelligence-frontend`, `npm run start`), created by the
same Blueprint apply in step 2 — there is no separate frontend deploy.

1. `NEXT_PUBLIC_API_URL` is wired automatically: the Blueprint sets it
   from the API service's hostname (`fromService`), and the frontend
   code adds `https://` (see `frontend/services/apiUrl.ts`). You do not
   type it by hand. It is baked into the frontend **at build time** —
   if you ever change it, redeploy the frontend service (Manual Deploy
   → Deploy latest commit) so the new value is picked up.
2. **Point the backend at the frontend:** after the first apply, open
   the frontend service in the Render dashboard and copy its URL
   (usually `https://competitor-intelligence-frontend.onrender.com`).
   If it differs from the `FRONTEND_URL` pre-filled in the Blueprint,
   set `FRONTEND_URL` to the exact URL (no trailing slash) on the
   `competitor-intelligence-api` service **and** the worker service,
   save, and redeploy both (Manual Deploy → Deploy latest commit, or
   they redeploy automatically on save). Until `FRONTEND_URL` matches,
   the frontend gets CORS errors and the login cookie is rejected.

## 4. Worker — confirm it is running

The worker is part of the Blueprint (`competitor-intelligence-worker`,
start command `node dist/worker.js`), so there is nothing extra to
deploy. Confirm it:

1. Render dashboard → the worker service → **Logs**. You should see:
   ```
   Database: connected — Connected to MongoDB
   Redis: connected — Connected to Redis
   [scan-worker] schedules resynced: N scheduled, ...
   Scan worker running — press Ctrl+C to stop
   ```
   (The "press Ctrl+C" line is just the startup message; on Render it
   runs until the service is stopped.)
2. If the logs instead show `Worker needs MongoDB` / `Worker needs
   Redis` and the service exits, the worker's `MONGODB_URI` / `REDIS_URL`
   is wrong or missing — fix it on the worker service's Environment tab.
3. What the worker does on startup: connects to MongoDB and Redis,
   starts the BullMQ scan worker, and re-creates the repeatable
   scheduled-scan job for every monitored competitor from its
   `monitoringFrequency` (hourly/daily/weekly). Paused competitors get
   no schedule.

## 5. Post-deploy checks (do these in order)

1. Open the Render frontend URL. The landing page should show **"Backend
   connected"** (live health check against the Render API).
2. **Register** a new account (creates your user + organization).
   You should land on the dashboard. If you are bounced back to
   `/login`, the auth cookie was not set — see Troubleshooting.
3. **Add a competitor** (Competitors → + Add competitor): a company
   name and a real website URL.
4. Open the competitor and press **Scan now**. The page polls the job
   (up to 2 minutes). It should finish with per-source results
   (`New snapshot` / `Unchanged` / `Blocked` / `Failed`) and the
   snapshot history below should fill in. If it stays queued forever,
   the worker is not running (step 4).
5. Optional, with a Groq key set: change something on the competitor's
   page, scan again, then **Analyse latest changes** — an AI analysis
   should appear. Then **Battlecards → Generate** to check the
   battlecard builds from the scan + analysis.
6. Optional: check scheduled scans — a competitor with
   `monitoringFrequency: daily` gets its repeatable job re-created on
   every worker restart; the next run shows up under Recent scan jobs.

## 6. Notion / Salesforce redirect URIs (only if you use integrations)

OAuth providers only redirect to URIs you registered. The `localhost`
values in `backend/.env.example` do not work in production.

1. **Notion:** https://www.notion.so/my-integrations → your public
   integration → set its **Redirect URI** to
   `https://<your-render-api>.onrender.com/api/integrations/notion/callback`
   and copy the **OAuth client ID** and **OAuth client secret** into
   Render as `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`, and the same
   URL as `NOTION_REDIRECT_URI`. The integration needs the capabilities
   **Read content** and **Insert content**. After connecting in the app,
   share the parent page with the integration in Notion (page … →
   Add connections).
2. **Salesforce:** Setup → App Manager → New Connected App → enable
   OAuth, add the callback URL
   `https://<your-render-api>.onrender.com/api/integrations/salesforce/callback`,
   scopes **api** + **refresh_token** (offline_access). Copy the
   **Consumer Key / Secret** into Render as `SALESFORCE_CLIENT_ID` /
   `SALESFORCE_CLIENT_SECRET`, and the callback URL as
   `SALESFORCE_REDIRECT_URI`. A free Developer Edition org works for
   testing: https://developer.salesforce.com
3. After changing any of these on Render, redeploy the API service.
   You can then connect from the app's **Integrations** page.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Frontend shows CORS error / API calls fail with `Failed to fetch` | `FRONTEND_URL` on Render does not exactly match the frontend URL (no trailing slash, `https`). Fix it on the API service and redeploy. The backend logs also warn at startup when `FRONTEND_URL` is unset in production. |
| Login/register bounces back to `/login`, or "not signed in" right after logging in | The auth cookie was not set. In production the cookie is `SameSite=None; Secure` (set automatically when `NODE_ENV=production`), which requires **HTTPS on both sides** — if either the frontend or the API is served over plain HTTP, the browser rejects the cookie. Check `FRONTEND_URL` matches the frontend URL exactly and that `NEXT_PUBLIC_API_URL` is the `https://` Render API URL. |
| `/api/health` shows `database: "disconnected"`; auth returns 503 "Database not connected" | `MONGODB_URI` is missing, wrong, or Atlas is blocking the connection. Check: (a) the username/password in the URI, URL-encoded if it has special characters; (b) Atlas **Network Access** allows `0.0.0.0/0`; (c) the cluster is not paused (free M0 clusters pause after inactivity — resume it in Atlas). Restart/redeploy the API after fixing. |
| API service crashes on start: `JWT_SECRET is not set` | Set `JWT_SECRET` on Render (API **and** worker). The backend refuses to start in production without it — by design. |
| `/api/health` shows `redis: "disconnected"` | The Redis service is down, paused, or `REDIS_URL` is wrong. Scans still work — manual scans run synchronously in the API request and scheduled scans are paused. Check the Redis service in the Render dashboard and that the API/worker `REDIS_URL` still points at it (Blueprint `fromService` wiring). |
| Scan stays "queued" forever / no scan jobs run | The worker service is not running (step 4). Check its logs. The API enqueues fine without a worker; nothing processes the queue. |
| First page load is very slow, later loads are fast | Render free web services sleep after ~15 min of inactivity; the first request wakes the service (~30–60 s). Expected on the free tier, not a bug. |
| `NEXT_PUBLIC_API_URL` change has no effect | It is baked in at build time. Redeploy the frontend service after changing it. |
| Render frontend build fails | Check the build logs: usually a missing env var is **not** the cause (the frontend falls back to `http://localhost:5000` when `NEXT_PUBLIC_API_URL` is unset, so the build passes but the deployed site cannot reach the API). A real build failure is a code/dependency issue — run `npm run build` in `frontend/` locally to reproduce. |
| Notion/Salesforce "Connect" fails or redirects to localhost | The redirect URI registered with the provider (and in Render) must be the public Render URL — see step 6. Also check `INTEGRATION_ENCRYPTION_KEY` is set; connecting without it is refused with a plain message. |

## 8. Costs

Everything in this guide is **free tier**:

| Service | Free tier | Caveat |
|---|---|---|
| MongoDB Atlas M0 | 512 MB storage, shared cluster | Pauses after inactivity; resume in Atlas. 512 MB is plenty for competitors/snapshots at this scale. |
| Render web services (free) — API + frontend | 750 free instance-hours/month | Both sleep after ~15 min without traffic — first load after sleep is slow (~30–60 s). No custom domain on free. |
| Render background worker (free) | 750 hours/month | Same sleep behaviour; a sleeping worker delays scheduled scans until it wakes. On the free tier, Render may spin the worker down — scheduled scans are best-effort, manual Scan now still works (it wakes the API, which enqueues; the worker wakes on demand). |
| Render Redis Key Value (free) | 25 MB, no persistence guarantees beyond the service | Enough for the BullMQ queue. `maxmemoryPolicy: noeviction` is set in the Blueprint so queued jobs are never evicted under memory pressure. |
| Groq API | Free tier with rate limits | AI analysis only; each analysis is one API call. |

Paid upgrades, only if you outgrow free: Render paid instance types
(no sleeping) and paid Redis (persistence + more memory), Atlas M10+
(dedicated cluster, no auto-pause). Nothing in the code needs to change
for those — they are the same services on bigger plans.

## Docker (optional alternative for the backend)

`backend/Dockerfile` builds a production image for the API; the same
image runs the worker by overriding the command. It is **not** used by
the Render Blueprint above (Render builds from source with `npm run
build`) — it is there if you ever deploy the backend to a container
host (e.g. Fly.io, a VPS) instead.

```bash
docker build -t competitor-intelligence-backend ./backend
# API:
docker run --env-file backend/.env -p 5000:5000 competitor-intelligence-backend
# Worker (same image, different command):
docker run --env-file backend/.env competitor-intelligence-backend node dist/worker.js
```

`backend/.env` is never copied into the image (see
`backend/.dockerignore`); all secrets come from the environment at
runtime. `npm ci` requires `backend/package-lock.json` — it exists;
do not delete it.
