// Phase 9: the Redis connection shared by the BullMQ queue and worker.
// BullMQ requires `maxRetriesPerRequest: null` on its connections, and it
// needs a *separate* connection per Queue / Worker / QueueEvents instance,
// so this module hands out fresh clients instead of one singleton.
// Redis is optional: if it is down, getRedisStatus() reports disconnected
// and callers fall back to synchronous scans (see queues/scanQueue.ts).
// Nothing here throws at import time — a missing Redis must never kill
// the API server, only the background jobs.
import IORedis from "ioredis";
import { env } from "./env";

let redisAvailable: boolean | null = null;
let lastError = "";

export function createRedisConnection(): IORedis {
  const client = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  // Only the 'ready' event updates the cached status. An 'error' event
  // from any one connection must NOT flip the whole app to "Redis down":
  // BullMQ opens several connections and a transient error (or a
  // connection closing on shutdown) would otherwise make every scan
  // fall back to synchronous even though Redis is fine. The live check
  // is checkRedis() below; enqueue failures are the real signal.
  client.on("ready", () => {
    redisAvailable = true;
    lastError = "";
  });
  return client;
}

export async function checkRedis(): Promise<{ connected: boolean; note: string }> {
  // A throwaway client with no shared event handlers, so its own
  // disconnect cannot poison the cached status.
  const client = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  try {
    await client.ping();
    redisAvailable = true;
    lastError = "";
    return { connected: true, note: "Connected to Redis" };
  } catch (err) {
    redisAvailable = false;
    lastError = err instanceof Error ? err.message : String(err);
    return { connected: false, note: `Redis not reachable at ${env.redisUrl} (${lastError})` };
  } finally {
    try {
      client.disconnect();
    } catch {
      // already closed
    }
  }
}

export function getRedisStatus(): { connected: boolean; note: string } {
  if (redisAvailable === true) return { connected: true, note: "Connected to Redis" };
  if (redisAvailable === false) {
    return { connected: false, note: lastError ? `Redis error: ${lastError}` : "Redis not reachable" };
  }
  return { connected: false, note: "Redis status not checked yet" };
}
