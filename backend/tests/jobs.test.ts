// Area 9 — jobs / queue: 202 + poll in Redis mode, synchronous
// fallback with Redis down, pause/resume/frequency rescheduling.
import crypto from "node:crypto";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { check, Client, eq, expectStatus, scanAndWait, tally, type SuiteCtx, type Tally } from "./helpers";

// BullMQ 5.81 stores legacy repeatable jobs (created by q.add with a
// `repeat` option) under an md5 of the repeat key —
//   md5(`scan-competitor:scan-scheduled-<id>:::<everyMs>`)
// — in the `repeat` sorted set. getRepeatableJobs() returns that hash
// as `key` (no `id` field), and getJobScheduler(id) only works for the
// newer upsertJobScheduler flow, so the test recomputes the expected
// hash exactly the way BullMQ does (see Repeat.getRepeatJobId /
// getRepeatConcatOptions in bullmq's repeat.js).
function repeatKey(competitorId: string, everyMs: number): string {
  return crypto
    .createHash("md5")
    .update(`scan-competitor:scan-scheduled-${competitorId}:::${everyMs}`)
    .digest("hex");
}

async function repeatableJobKeys(): Promise<string[]> {
  const connection = new IORedis("redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
  const queue = new Queue("scan-queue", { connection });
  try {
    const jobs = await queue.getRepeatableJobs();
    return jobs.map((j) => String((j as { key?: string }).key ?? ""));
  } finally {
    await queue.close();
    connection.disconnect();
  }
}

export async function run(ctx: SuiteCtx): Promise<Tally> {
  const t = tally("jobs");
  const { A, B } = ctx;
  const compId: string = ctx.state.scanCompId;

  if (ctx.mode === "with-redis") {
    // POST /scan returns 202 with a job id; polling reaches completed.
    const res = await A.post(`/api/competitors/${compId}/scan`);
    ctx.expensiveA++;
    expectStatus(t, "scan with Redis returns 202", res, 202);
    check(t, "scan response is queued:true with a jobId", res.json?.queued === true && typeof res.json?.jobId === "string", JSON.stringify(res.json));
    const jobId: string = res.json.jobId;
    const scanJobId: string | undefined = res.json.scanJobId;
    check(t, "scan response carries a scanJobId", typeof scanJobId === "string");
    if (scanJobId) ctx.state.scanJobId = scanJobId;

    const deadline = Date.now() + 60000;
    let final: any = null;
    while (Date.now() < deadline) {
      const job = await A.get(`/api/jobs/${scanJobId ?? jobId}`);
      if (job.json?.scanJob?.status === "completed" || job.json?.scanJob?.status === "failed") {
        final = job.json.scanJob;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    check(t, "queued scan job completes", final?.status === "completed", JSON.stringify(final));
    check(t, "completed job has a result summary", Array.isArray(final?.resultSummary?.results) && final.resultSummary.results.length > 0, JSON.stringify(final?.resultSummary));

    // Scan-jobs lists show the run (per-competitor + org-wide).
    const perComp = await A.get(`/api/competitors/${compId}/scan-jobs`);
    expectStatus(t, "per-competitor scan-jobs returns 200", perComp, 200);
    check(t, "per-competitor scan-jobs contains the run", (perComp.json?.scanJobs ?? []).some((j: any) => j.id === scanJobId));
    const orgJobs = await A.get("/api/jobs");
    expectStatus(t, "org scan-jobs returns 200", orgJobs, 200);
    check(t, "org scan-jobs contains the run", (orgJobs.json?.scanJobs ?? []).some((j: any) => j.id === scanJobId));
    check(t, "org scan-jobs reports Redis connected", orgJobs.json?.redis?.connected === true, JSON.stringify(orgJobs.json?.redis));
    check(t, "org scan-jobs reports queue counts", orgJobs.json?.queueCounts !== null && typeof orgJobs.json?.queueCounts === "object", JSON.stringify(orgJobs.json?.queueCounts));
    const crossJob = await B.get(`/api/jobs/${scanJobId}`);
    expectStatus(t, "cross-org scan job returns 404", crossJob, 404);

    // Repeatable schedule: present after create, gone when paused,
    // back when resumed, still exactly one after a frequency change.
    const dailyKey = repeatKey(compId, 24 * 60 * 60 * 1000);
    const hourlyKey = repeatKey(compId, 60 * 60 * 1000);
    check(t, "repeatable job exists for the monitored competitor", (await repeatableJobKeys()).includes(dailyKey));
    const paused = await A.patch(`/api/competitors/${compId}`, { isMonitoringEnabled: false });
    expectStatus(t, "pause returns 200", paused, 200);
    check(t, "repeatable job is gone after pausing", !(await repeatableJobKeys()).includes(dailyKey));
    // A manual scan still works while paused.
    const manualWhilePaused = await scanAndWait(ctx, A, compId);
    check(t, "manual scan still runs while paused", manualWhilePaused.length === 4, JSON.stringify(manualWhilePaused));
    const resumed = await A.patch(`/api/competitors/${compId}`, { isMonitoringEnabled: true });
    expectStatus(t, "resume returns 200", resumed, 200);
    check(t, "repeatable job is back after resuming", (await repeatableJobKeys()).includes(dailyKey));
    const freq = await A.patch(`/api/competitors/${compId}`, { monitoringFrequency: "hourly" });
    expectStatus(t, "frequency change returns 200", freq, 200);
    const keysAfterFreq = await repeatableJobKeys();
    eq(t, "frequency change leaves exactly one repeatable job (hourly)", keysAfterFreq.filter((k) => k === hourlyKey).length, 1);
    check(t, "frequency change removed the daily repeatable job", !keysAfterFreq.includes(dailyKey));
    const backToDaily = await A.patch(`/api/competitors/${compId}`, { monitoringFrequency: "daily" });
    expectStatus(t, "frequency change back returns 200", backToDaily, 200);
  } else {
    // No Redis: the same scan falls back to synchronous (queued:false)
    // and still writes a ScanJob record.
    const before = await A.get(`/api/competitors/${compId}/scan-jobs?limit=100`);
    const beforeCount = (before.json?.scanJobs ?? []).length;
    const res = await A.post(`/api/competitors/${compId}/scan`);
    ctx.expensiveA++;
    expectStatus(t, "scan without Redis returns 200 (sync fallback)", res, 200);
    check(t, "sync fallback reports queued:false with a scan summary", res.json?.queued === false && Array.isArray(res.json?.scan?.results), JSON.stringify(res.json)?.slice(0, 300));
    const after = await A.get(`/api/competitors/${compId}/scan-jobs?limit=100`);
    check(t, "sync fallback still writes a ScanJob record", (after.json?.scanJobs ?? []).length === beforeCount + 1, `before=${beforeCount} after=${(after.json?.scanJobs ?? []).length}`);
    const newest = (after.json?.scanJobs ?? [])[0];
    eq(t, "sync ScanJob is completed", newest?.status, "completed");
    if (newest?.id) ctx.state.scanJobId = newest.id;
    check(t, "sync ScanJob is a manual trigger", newest?.trigger === "manual", JSON.stringify(newest));
    const health = await A.get("/api/health");
    check(t, "health reports Redis disconnected in no-Redis mode", health.json?.redis === "disconnected", JSON.stringify(health.json?.redis));

    // Pause/resume still flips the flag, and a manual scan still works.
    const paused = await A.patch(`/api/competitors/${compId}`, { isMonitoringEnabled: false });
    expectStatus(t, "pause returns 200 (no Redis)", paused, 200);
    eq(t, "competitor is paused", paused.json?.competitor?.isMonitoringEnabled, false);
    const manualWhilePaused = await scanAndWait(ctx, A, compId);
    check(t, "manual scan still runs while paused (no Redis)", manualWhilePaused.length === 4, JSON.stringify(manualWhilePaused));
    const resumed = await A.patch(`/api/competitors/${compId}`, { isMonitoringEnabled: true });
    expectStatus(t, "resume returns 200 (no Redis)", resumed, 200);
  }

  // Unauthenticated 401 on the jobs endpoints (both modes).
  const anon = new Client(ctx.baseUrl);
  const unauthList = await anon.get("/api/jobs");
  expectStatus(t, "jobs list without auth returns 401", unauthList, 401);
  const unauthOne = await anon.get("/api/jobs/000000000000000000000000");
  expectStatus(t, "single job without auth returns 401", unauthOne, 401);

  return t;
}
