import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import competitorsRouter from "./routes/competitors";
import changesRouter from "./routes/changes";
import battlecardsRouter from "./routes/battlecards";
import dashboardRouter from "./routes/dashboard";
import jobsRouter from "./routes/jobs";
import integrationsRouter from "./routes/integrations";

const app = express();

// Phase 11: security headers on every response (X-Content-Type-Options,
// X-Frame-Options, Strict-Transport-Security in production, and the rest
// of helmet's defaults). The API serves JSON only, so the default
// Content-Security-Policy is safe here. helmet also removes the
// X-Powered-By header, so responses do not advertise the stack.
app.use(helmet());

// credentials: true is required — the auth cookie must travel with
// cross-origin requests from the frontend (localhost:3000) to the API (localhost:5000).
app.use(cors({ origin: env.frontendUrl, credentials: true }));
// Explicit 100kb JSON body limit (also the Express default): a request
// body can never be used to exhaust server memory.
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/competitors", competitorsRouter);
app.use("/api/changes", changesRouter);
app.use("/api/battlecards", battlecardsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/integrations", integrationsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralised error handler (PRD section 18). Body-parser errors carry
// their own status (400 bad JSON, 413 over the 100kb limit) — honour it
// instead of masking every failure as a 500. Anything else is a 500
// with no internals leaked.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? "Request body too large" : "Invalid request" });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
