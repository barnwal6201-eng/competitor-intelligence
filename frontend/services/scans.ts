import type { ScanEnqueueResult, ScanSummary, Snapshot } from "@/types";

// Scan + snapshot API calls (Phase 4, Phase 9). Every call sends the
// httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

// Phase 9: POST /scan now enqueues a background job (202) instead of
// scraping in the request. The return tells the page whether the scan
// was queued (poll GET /api/jobs/:jobId until completed/failed) or ran
// synchronously because Redis was down (queued: false, scan included).
export async function triggerScan(competitorId: string): Promise<ScanEnqueueResult> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/scan`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<ScanEnqueueResult>(res);
}

export async function listSnapshots(
  competitorId: string,
  type?: string
): Promise<Snapshot[]> {
  const suffix = type ? `?type=${encodeURIComponent(type)}` : "";
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/snapshots${suffix}`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ snapshots: Snapshot[] }>(res)).snapshots;
}
