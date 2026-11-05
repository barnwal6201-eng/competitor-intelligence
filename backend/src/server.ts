import app from "./app";
import { env } from "./config/env";
import { connectDb } from "./config/db";

async function start() {
  const db = await connectDb();
  console.log(`Database: ${db.connected ? "connected" : "disconnected"} — ${db.note}`);

  app.listen(env.port, () => {
    console.log(`Backend running at http://localhost:${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/api/health`);
    console.log(`Accepting frontend origin: ${env.frontendUrl}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
