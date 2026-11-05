# Competitor Intelligence Scraper & Battlecard Agent

Phases 1–2 of the PRD (v1.1, section 23) are done. Nothing is faked here —
every screen shows real data from the backend.

- **Phase 1:** project setup and frontend-backend communication.
- **Phase 2:** database models + register/login with bcrypt and HTTP-only cookies
  + protected backend routes and protected frontend routes.

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
    middleware.ts           # redirects /dashboard to /login without a token cookie
    services/               # api.ts (health), auth.ts (register/login/logout/me)
    types/
  backend/
    src/
      config/       # env.ts, db.ts
      models/       # User, Organization, Competitor (Phase 2)
      controllers/  # authController.ts
      routes/       # health.ts, auth.ts
      middleware/   # auth.ts (requireAuth)
      validators/   # auth.ts (Zod schemas)
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

## Troubleshooting

| Problem | Fix |
|---|---|
| Frontend says "Backend not reachable" | Backend terminal must be running (`npm run dev` in `backend`). Check http://localhost:5000/api/health first. |
| `/api/auth` returns 503 "Database not connected" | `MONGODB_URI` is missing or wrong in `backend/.env`. Restart the backend after editing `.env` — it reads the file only at startup. |
| Register/login fails with an Atlas error | Check the Atlas username/password in the URI, and Network Access (your IP must be allowed). The backend terminal prints the real connection error. |
| Dashboard keeps redirecting to /login | The login cookie was not set — make sure the frontend is on http://localhost:3000 and the backend `FRONTEND_URL` matches it. Do not open the frontend on 127.0.0.1 while the backend expects localhost. |
| Port 5000 or 3000 already in use | Find it with `netstat -ano \| findstr :5000` (Windows) and stop that process, or change `PORT` in `backend/.env` and `NEXT_PUBLIC_API_URL` in `frontend/.env.local` together. |
| `npm install` fails | Delete `node_modules` and `package-lock.json` in that folder only, then run `npm install` again. |

## What is NOT done yet (deliberately)

- No competitor CRUD — that is Phase 3 (the Competitor model is already defined).
- No scraping (Playwright/Cheerio), no change detection — Phase 4 and 5.
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

## Next step: Phase 3

Competitor management — add/edit/delete/search/filter competitors (CRUD APIs
+ Next.js pages), all scoped to the signed-in user's organization.
