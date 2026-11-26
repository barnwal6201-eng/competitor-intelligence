// Phase 11 test suite — shared helpers.
// Small HTTP client with a cookie jar, tally helpers, process/port
// helpers, and the scan/analyse wrappers every area file shares.
// Runs under tsx from backend/ (so ../src/... imports resolve).
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const BACKEND_DIR = path.resolve(__dirname, "..");
export const TEST_DB_NAME = "ci-phase11-test";
export const TEST_DB_URI = `mongodb://127.0.0.1:27017/${TEST_DB_NAME}`;

// ---------------------------------------------------------------- tallies
export interface Tally {
  name: string;
  pass: number;
  fail: number;
  failures: string[];
}

export function tally(name: string): Tally {
  return { name, pass: 0, fail: 0, failures: [] };
}

export function check(t: Tally, label: string, cond: unknown, detail = ""): boolean {
  if (cond) {
    t.pass++;
    return true;
  }
  t.fail++;
  const line = `${label}${detail ? ` — ${detail}` : ""}`;
  t.failures.push(line);
  console.log(`  FAIL [${t.name}] ${line}`);
  return false;
}

export function eq(t: Tally, label: string, actual: unknown, expected: unknown): boolean {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return check(t, label, a === e, `expected ${e}, got ${a}`);
}

export function expectStatus(t: Tally, label: string, res: HttpRes, status: number): boolean {
  return check(t, label, res.status === status, `expected HTTP ${status}, got ${res.status}: ${res.text.slice(0, 300)}`);
}

// ---------------------------------------------------------------- HTTP
export interface HttpRes {
  status: number;
  headers: Headers;
  setCookies: string[];
  text: string;
  json: any;
}

export interface ReqOpts {
  rawBody?: string;
  headers?: Record<string, string>;
  followRedirect?: boolean;
}

export class Client {
  cookie = "";
  constructor(public baseUrl: string) {}

  async req(method: string, p: string, body?: unknown, opts: ReqOpts = {}): Promise<HttpRes> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (this.cookie) headers.Cookie = this.cookie;
    let b: string | undefined;
    if (opts.rawBody !== undefined) {
      b = opts.rawBody;
      headers["Content-Type"] = "application/json";
    } else if (body !== undefined) {
      b = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(this.baseUrl + p, {
      method,
      headers,
      body: b,
      redirect: opts.followRedirect === false ? "manual" : "follow",
    });
    const setCookies: string[] = ((res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []);
    for (const c of setCookies) {
      const m = /^token=([^;]*)/.exec(c);
      if (m) this.cookie = m[1] ? `token=${m[1]}` : "";
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON (redirects etc.)
    }
    return { status: res.status, headers: res.headers, setCookies, text, json };
  }

  get(p: string, o?: ReqOpts): Promise<HttpRes> {
    return this.req("GET", p, undefined, o);
  }
  post(p: string, body?: unknown, o?: ReqOpts): Promise<HttpRes> {
    return this.req("POST", p, body, o);
  }
  patch(p: string, body?: unknown, o?: ReqOpts): Promise<HttpRes> {
    return this.req("PATCH", p, body, o);
  }
  put(p: string, body?: unknown, o?: ReqOpts): Promise<HttpRes> {
    return this.req("PUT", p, body, o);
  }
  del(p: string, o?: ReqOpts): Promise<HttpRes> {
    return this.req("DELETE", p, undefined, o);
  }
}

export async function register(
  client: Client,
  name: string,
  email: string,
  org?: string
): Promise<HttpRes> {
  return client.post("/api/auth/register", {
    name,
    email,
    password: "TestPass123!",
    organizationName: org,
  });
}

export function noPasswordHash(t: Tally, label: string, res: HttpRes): boolean {
  return check(t, label, !res.text.includes("passwordHash"), `response leaks passwordHash: ${res.text.slice(0, 200)}`);
}

// ---------------------------------------------------------------- misc
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function portOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect(port, host);
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });
}

export async function waitForPort(port: number, timeoutMs = 30000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await portOpen(port)) return;
    await sleep(250);
  }
  throw new Error(`port ${port} did not open within ${timeoutMs}ms`);
}

export async function waitForHealth(baseUrl: string, timeoutMs = 30000): Promise<void> {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      const j = (await res.json()) as { database?: string };
      if (res.status === 200 && j.database === "connected") return;
      last = `HTTP ${res.status} database=${j.database}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await sleep(500);
  }
  throw new Error(`backend at ${baseUrl} did not become healthy within ${timeoutMs}ms (last: ${last})`);
}

// ---------------------------------------------------------------- backend processes
export interface BackendHandle {
  proc: ChildProcess;
  baseUrl: string;
  port: number;
  logPath: string;
  output: string;
}

export function startBackend(opts: {
  port: number;
  env: Record<string, string | undefined>;
  cwd?: string;
  logTag?: string;
}): BackendHandle {
  const logDir = path.join(BACKEND_DIR, "tests", "run-logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `backend-${opts.logTag ?? opts.port}.log`);
  const stream = fs.createWriteStream(logPath, { flags: "w" });
  const handle: BackendHandle = {
    proc: null as unknown as ChildProcess,
    baseUrl: `http://127.0.0.1:${opts.port}`,
    port: opts.port,
    logPath,
    output: "",
  };
  const env: Record<string, string | undefined> = { ...process.env };
  for (const [k, v] of Object.entries(opts.env)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const proc = spawn("node", ["dist/server.js"], {
    cwd: opts.cwd ?? BACKEND_DIR,
    env: env as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  handle.proc = proc;
  proc.stdout?.on("data", (d: Buffer) => {
    const s = d.toString();
    handle.output += s;
    stream.write(s);
  });
  proc.stderr?.on("data", (d: Buffer) => {
    const s = d.toString();
    handle.output += s;
    stream.write(s);
  });
  return handle;
}

export async function stopBackend(h: BackendHandle, timeoutMs = 10000): Promise<void> {
  if (!h.proc || h.proc.exitCode !== null) return;
  h.proc.kill("SIGTERM");
  const t0 = Date.now();
  while (h.proc.exitCode === null && Date.now() - t0 < timeoutMs) await sleep(200);
  if (h.proc.exitCode === null) {
    try {
      h.proc.kill("SIGKILL");
    } catch {
      // already gone
    }
    await sleep(500);
  }
}

export async function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<number | null> {
  const t0 = Date.now();
  while (proc.exitCode === null && Date.now() - t0 < timeoutMs) await sleep(200);
  return proc.exitCode;
}

// ---------------------------------------------------------------- suite context
export interface SuiteCtx {
  mode: "no-redis" | "with-redis";
  baseUrl: string;
  mockSitePort: number;
  mockGroqPort: number;
  mockNotionPort: number;
  mockSalesforcePort: number;
  A: Client;
  B: Client;
  C: Client;
  orgA: string;
  orgB: string;
  state: Record<string, any>;
  /** Expensive-limiter calls made as user A on the main backend (budget 30). */
  expensiveA: number;
}

export function siteUrl(ctx: SuiteCtx, p: string): string {
  return `http://127.0.0.1:${ctx.mockSitePort}${p}`;
}

// ---------------------------------------------------------------- scan / analyse wrappers
export interface ScanResult {
  sourceType: string;
  outcome: string;
  changesDetected?: number;
  message?: string;
}

/**
 * Trigger a scan and wait for the outcome, in either mode.
 * Redis mode: 202 + poll the ScanJob record. No-Redis mode: synchronous
 * 200 with { queued:false, scan }.
 */
export async function scanAndWait(
  ctx: SuiteCtx,
  client: Client,
  competitorId: string,
  timeoutMs = 90000
): Promise<ScanResult[]> {
  if (client === ctx.A) ctx.expensiveA++;
  const res = await client.post(`/api/competitors/${competitorId}/scan`);
  if (res.status === 202 && res.json?.queued === true) {
    const scanJobId: string | undefined = res.json.scanJobId;
    const jobId: string | undefined = res.json.jobId;
    const pollId = scanJobId ?? jobId;
    if (!pollId) throw new Error(`202 scan response had no job id: ${res.text}`);
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const job = await client.get(`/api/jobs/${pollId}`);
      const sj = job.json?.scanJob;
      if (sj && (sj.status === "completed" || sj.status === "failed")) {
        if (sj.status === "failed") {
          throw new Error(`scan job failed: ${sj.errorMessage ?? job.text}`);
        }
        const results = sj.resultSummary?.results as ScanResult[] | undefined;
        if (!results) throw new Error(`completed scan job has no resultSummary: ${job.text}`);
        return results;
      }
      await sleep(500);
    }
    throw new Error(`scan job ${pollId} did not complete within ${timeoutMs}ms`);
  }
  if (res.status === 200 && res.json?.queued === false) {
    return res.json.scan.results as ScanResult[];
  }
  throw new Error(`scan failed: HTTP ${res.status}: ${res.text.slice(0, 400)}`);
}

export async function analyse(
  ctx: SuiteCtx,
  client: Client,
  competitorId: string,
  body?: unknown
): Promise<HttpRes> {
  if (client === ctx.A) ctx.expensiveA++;
  return client.post(`/api/competitors/${competitorId}/analyze`, body);
}

export function tmpDir(): string {
  return os.tmpdir();
}
