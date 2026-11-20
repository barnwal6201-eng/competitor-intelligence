import type { ScanJob } from "@/types";

// Scan-job API calls (Phase 9). Every call sends the httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export async function getScanJob(jobId: string): Promise<ScanJob> {
  const res = await fetch(`${API_URL}/api/jobs/${encodeURIComponent(jobId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ scanJob: ScanJob }>(res)).scanJob;
}

export async function listScanJobs(competitorId?: string, limit = 20): Promise<ScanJob[]> {
  const params = new URLSearchParams();
  if (competitorId) params.set("competitorId", competitorId);
  params.set("limit", String(limit));
  const res = await fetch(`${API_URL}/api/jobs?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ scanJobs: ScanJob[] }>(res)).scanJobs;
}

export async function listCompetitorScanJobs(competitorId: string, limit = 20): Promise<ScanJob[]> {
  const res = await fetch(
    `${API_URL}/api/competitors/${competitorId}/scan-jobs?limit=${limit}`,
    { credentials: "include", cache: "no-store" }
  );
  return (await handleResponse<{ scanJobs: ScanJob[] }>(res)).scanJobs;
}
