// Phase 11 — full test suite runner. `npm test` in backend/ runs this.
//   1. Starts mongod itself if port 27017 is not listening (kills it by
//      exact PID from the pidfile at the end, ONLY if it started it).
//   2. Builds the backend (npm run build).
//   3. Starts the mock servers (fake site, Groq, Notion, Salesforce).
//   4. Runs every area twice: WITHOUT Redis (REDIS_URL → dead port 6390)
//      and WITH Redis (local redis-server on 6379, started here).
//      Each mode gets a fresh backend process and a freshly dropped DB.
//   5. Prints per-area counts and a final TOTAL; exits non-zero on any
//      failure (except a genuinely unavailable Redis: the with-Redis
//      mode then prints SKIP and the run still exits 0 if no-Redis passed).
import { execSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import {
  BACKEND_DIR,
  Client,
  portOpen,
  sleep,
  startBackend,
  stopBackend,
  TEST_DB_NAME,
  TEST_DB_URI,
  waitForHealth,
  waitForPort,
  type SuiteCtx,
  type Tally,
} from "./helpers";
import { startMockSite, startMockGroq, startMockNotion, startMockSalesforce } from "./mocks";
import * as authArea from "./auth.test";
import * as competitorsArea from "./competitors.test";
import * as scrapingArea from "./scraping.test";
import * as ssrfArea from "./ssrf.test";
import * as changesArea from "./changes.test";
import * as analysisArea from "./analysis.test";
import * as battlecardsArea from "./battlecards.test";
import * as dashboardArea from "./dashboard.test";
import * as jobsArea from "./jobs.test";
import * as integrationsArea from "./integrations.test";
import * as securityArea from "./security.test";

const HOME = os.homedir();
const MONGO_DATA = path.join(HOME, "workspace/tools/mongodb/data");
const MONGO_BIN = path.join(HOME, "workspace/tools/mongodb/mongod");
const MONGO_LOG = path.join(HOME, "workspace/tools/mongodb/mongod.log");
const MONGO_PID = path.join(HOME, "workspace/tools/mongodb/mongod.pid");
const REDIS_DATA = path.join(HOME, "workspace/tools/redis/data");
const REDIS_PID = path.join(HOME, "workspace/tools/redis/redis-test.pid");
const REDIS_LOG = path.join(HOME, "workspace/tools/redis/redis-test.log");
const REDIS_COMPILED = path.join(HOME, "workspace/tools/redis/redis-7.4.1/src/redis-server");
const REDIS_CLI_COMPILED = path.join(HOME, "workspace/tools/redis/redis-7.4.1/src/redis-cli");

const SITE_PORT = 5121;
const GROQ_PORT = 5122;
const NOTION_PORT = 5123;
const SALESFORCE_PORT = 5124;

// ---------------------------------------------------------------- mongod
async function ensureMongod(): Promise<boolean> {
  if (await portOpen(27017)) {
    console.log("[run-all] mongod already listening on 27017 — using it");
    return false;
  }
  console.log("[run-all] starting mongod (dbpath ~/workspace/tools/mongodb/data) …");
  fs.mkdirSync(MONGO_DATA, { recursive: true });
  const r = spawnSync(MONGO_BIN, [
    "--fork",
    "--dbpath", MONGO_DATA,
    "--logpath", MONGO_LOG,
    "--pidfilepath", MONGO_PID,
    "--bind_ip", "127.0.0.1",
    "--port", "27017",
  ], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`mongod --fork failed: ${r.stdout} ${r.stderr}`);
  await waitForPort(27017, 30000);
  console.log("[run-all] mongod up");
  return true;
}

async function stopOwnMongod(): Promise<void> {
  try {
    const pid = Number(fs.readFileSync(MONGO_PID, "utf8").trim());
    if (pid > 0) {
      process.kill(pid, "SIGTERM");
      const t0 = Date.now();
      while ((await portOpen(27017)) && Date.now() - t0 < 10000) await sleep(250);
      console.log("[run-all] mongod stopped");
    }
  } catch (err) {
    console.log(`[run-all] could not stop mongod by pidfile: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------- redis
function resolveRedisServer(): string | null {
  const candidates = ["/usr/bin/redis-server", "/usr/local/bin/redis-server", REDIS_COMPILED];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  console.log("[run-all] redis-server not found — trying apt-get install …");
  try {
    execSync("apt-get update && apt-get install -y redis-server", { stdio: "inherit", timeout: 300000 });
  } catch {
    console.log("[run-all] apt-get install of redis-server failed");
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  const which = spawnSync("command", ["-v", "redis-server"], { encoding: "utf8" });
  if (which.stdout.trim()) return "redis-server";
  return null;
}

function resolveRedisCli(redisServer: string): string {
  if (redisServer === REDIS_COMPILED && fs.existsSync(REDIS_CLI_COMPILED)) return REDIS_CLI_COMPILED;
  return "redis-cli";
}

async function startRedis(redisServer: string): Promise<void> {
  fs.mkdirSync(REDIS_DATA, { recursive: true });
  const r = spawnSync(redisServer, [
    "--port", "6379",
    "--daemonize", "yes",
    "--dir", REDIS_DATA,
    "--dbfilename", "dump-phase11.rdb",
    "--pidfile", REDIS_PID,
    "--logfile", REDIS_LOG,
    "--save", "",
    "--appendonly", "no",
  ], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`redis-server failed to start: ${r.stdout} ${r.stderr}`);
  await waitForPort(6379, 15000);
  console.log("[run-all] redis-server up on 6379");
}

async function stopRedis(redisCli: string): Promise<void> {
  try {
    spawnSync(redisCli, ["-p", "6379", "shutdown", "nosave"], { encoding: "utf8", timeout: 10000 });
  } catch {
    // fall through to PID kill
  }
  await sleep(500);
  if (await portOpen(6379)) {
    try {
      const pid = Number(fs.readFileSync(REDIS_PID, "utf8").trim());
      if (pid > 0) process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

// ---------------------------------------------------------------- one mode
async function runMode(
  mode: "no-redis" | "with-redis",
  mocks: { site: any; groq: any; notion: any; salesforce: any },
  encryptionKey: string
): Promise<{ tallies: Tally[]; pass: number; fail: number }> {
  const port = mode === "no-redis" ? 5101 : 5102;
  console.log(`\n===== MODE: ${mode} (backend :${port}) =====`);

  await mongoose.connection.db?.dropDatabase();
  mocks.site.reset();
  mocks.groq.mode = "ok";

  const backend = startBackend({
    port,
    logTag: mode,
    env: {
      PORT: String(port),
      NODE_ENV: "development",
      MONGODB_URI: TEST_DB_URI,
      JWT_SECRET: "test-secret-123",
      FRONTEND_URL: "http://localhost:3000",
      REDIS_URL: mode === "no-redis" ? "redis://127.0.0.1:6390" : "redis://127.0.0.1:6379",
      SCAN_WORKER_IN_PROCESS: "true",
      ALLOW_PRIVATE_SCRAPE_URLS: "true",
      OPENAI_API_KEY: "test-groq-key",
      OPENAI_MODEL: "openai/gpt-oss-120b",
      GROQ_API_BASE_URL: `http://127.0.0.1:${GROQ_PORT}`,
      NOTION_API_BASE_URL: `http://127.0.0.1:${NOTION_PORT}`,
      NOTION_CLIENT_ID: "test-notion-id",
      NOTION_CLIENT_SECRET: "test-notion-secret",
      NOTION_REDIRECT_URI: `http://localhost:${port}/api/integrations/notion/callback`,
      SALESFORCE_LOGIN_URL: `http://127.0.0.1:${SALESFORCE_PORT}`,
      SALESFORCE_CLIENT_ID: "test-sf-id",
      SALESFORCE_CLIENT_SECRET: "test-sf-secret",
      SALESFORCE_REDIRECT_URI: `http://localhost:${port}/api/integrations/salesforce/callback`,
      INTEGRATION_ENCRYPTION_KEY: encryptionKey,
    },
  });

  const tallies: Tally[] = [];
  try {
    await waitForHealth(backend.baseUrl, 60000);
    console.log(`[run-all] backend healthy at ${backend.baseUrl}`);

    const ctx: SuiteCtx = {
      mode,
      baseUrl: backend.baseUrl,
      mockSitePort: SITE_PORT,
      mockGroqPort: GROQ_PORT,
      mockNotionPort: NOTION_PORT,
      mockSalesforcePort: SALESFORCE_PORT,
      A: new Client(backend.baseUrl),
      B: new Client(backend.baseUrl),
      C: new Client(backend.baseUrl),
      orgA: "",
      orgB: "",
      state: {},
      expensiveA: 0,
    };

    const steps: [string, () => Promise<Tally>][] = [
      ["auth", () => authArea.run(ctx)],
      ["competitors", () => competitorsArea.run(ctx)],
      ["scraping", () => scrapingArea.run(ctx, mocks.site)],
      ["ssrf", () => ssrfArea.run(ctx)],
      ["changes", () => changesArea.run(ctx)],
      ["analysis", () => analysisArea.run(ctx, mocks.groq, mocks.site)],
      ["battlecards", () => battlecardsArea.run(ctx)],
      ["dashboard", () => dashboardArea.run(ctx, mocks.site)],
      ["jobs", () => jobsArea.run(ctx)],
      ["integrations", () => integrationsArea.run(ctx, mocks.notion, mocks.salesforce)],
      ["security", () => securityArea.run(ctx)],
    ];
    for (const [name, fn] of steps) {
      const t0 = Date.now();
      try {
        const t = await fn();
        tallies.push(t);
        console.log(`  [${mode}] ${name}: ${t.pass}/${t.pass + t.fail} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        if (t.fail > 0) for (const f of t.failures) console.log(`      - ${f}`);
      } catch (err) {
        const t: Tally = { name, pass: 0, fail: 1, failures: [`area threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`] };
        tallies.push(t);
        console.log(`  [${mode}] ${name}: THREW — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(`  [${mode}] user A expensive-limiter calls: ${ctx.expensiveA} (budget 30 before the rate test)`);
  } finally {
    await stopBackend(backend);
    await mongoose.connection.db?.dropDatabase();
  }

  const pass = tallies.reduce((a, t) => a + t.pass, 0);
  const fail = tallies.reduce((a, t) => a + t.fail, 0);
  console.log(`===== MODE ${mode}: ${pass}/${pass + fail} =====`);
  return { tallies, pass, fail };
}

// ---------------------------------------------------------------- main
async function main(): Promise<void> {
  const t0 = Date.now();
  const encryptionKey = crypto.randomBytes(32).toString("hex");
  process.env.INTEGRATION_ENCRYPTION_KEY = encryptionKey;

  let mongodStarted = false;
  let redisServer: string | null = null;
  let redisCli = "redis-cli";
  let redisStarted = false;
  const mocks = { site: null as any, groq: null as any, notion: null as any, salesforce: null as any };

  try {
    mongodStarted = await ensureMongod();

    console.log("[run-all] building backend (npm run build) …");
    execSync("npm run build", { cwd: BACKEND_DIR, stdio: "inherit" });

    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 5000 });

    console.log("[run-all] starting mock servers …");
    mocks.site = await startMockSite(SITE_PORT);
    mocks.groq = await startMockGroq(GROQ_PORT);
    mocks.notion = await startMockNotion(NOTION_PORT);
    mocks.salesforce = await startMockSalesforce(SALESFORCE_PORT);

    // ---- mode 1: no Redis ----
    const noRedis = await runMode("no-redis", mocks, encryptionKey);

    // ---- mode 2: with Redis ----
    redisServer = resolveRedisServer();
    let withRedis: { pass: number; fail: number } | null = null;
    if (!redisServer) {
      console.log("\n===== MODE with-redis: SKIP =====");
      console.log("redis-server is genuinely unavailable (not in PATH, not at the known");
      console.log("compiled path, and apt-get install failed). To run this mode, install");
      console.log("Redis:  apt-get update && apt-get install -y redis-server");
      console.log("then re-run:  npm test");
    } else {
      redisCli = resolveRedisCli(redisServer);
      await startRedis(redisServer);
      redisStarted = true;
      try {
        withRedis = await runMode("with-redis", mocks, encryptionKey);
      } finally {
        await stopRedis(redisCli);
        redisStarted = false;
      }
    }

    const totalPass = noRedis.pass + (withRedis?.pass ?? 0);
    const totalFail = noRedis.fail + (withRedis?.fail ?? 0);
    console.log(`\n================ TOTAL: ${totalPass}/${totalPass + totalFail} =================`);
    console.log(`  no-redis:   ${noRedis.pass}/${noRedis.pass + noRedis.fail}`);
    if (withRedis) console.log(`  with-redis: ${withRedis.pass}/${withRedis.pass + withRedis.fail}`);
    else console.log("  with-redis: SKIPPED (redis-server unavailable — see above)");
    console.log(`  elapsed: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (totalFail > 0) {
      console.log("RESULT: FAIL");
      process.exitCode = 1;
    } else {
      console.log("RESULT: PASS");
      process.exitCode = 0;
    }
  } catch (err) {
    console.error("[run-all] fatal error:", err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  } finally {
    for (const m of [mocks.site, mocks.groq, mocks.notion, mocks.salesforce]) {
      try {
        await m?.close();
      } catch {
        // already closed
      }
    }
    try {
      await mongoose.disconnect();
    } catch {
      // already disconnected
    }
    if (redisStarted) {
      try {
        await stopRedis(redisCli);
      } catch {
        // best effort
      }
    }
    if (mongodStarted) await stopOwnMongod();
  }
}

main();
