import express from "express";
import cors from "cors";
import { env } from "./config/env";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import competitorsRouter from "./routes/competitors";
import changesRouter from "./routes/changes";

const app = express();

// credentials: true is required — the auth cookie must travel with
// cross-origin requests from the frontend (localhost:3000) to the API (localhost:5000).
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/competitors", competitorsRouter);
app.use("/api/changes", changesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralised error handler (PRD section 18).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
