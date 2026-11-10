import type { ScanSummary, Snapshot } from "@/types";

// Scan + snapshot API calls (Phase 4). Every call sends the httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export async function triggerScan(competitorId: string): Promise<ScanSummary> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/scan`, {
    method: "POST",
    credentials: "include",
  });
  return (await handleResponse<{ scan: ScanSummary }>(res)).scan;
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
