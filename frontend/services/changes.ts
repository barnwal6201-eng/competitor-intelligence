import type { ChangeEvent } from "@/types";

// Change + intelligence-feed API calls (Phase 5). Every call sends the
// httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export type ChangeFilters = {
  type?: string;
  significance?: string;
  limit?: number;
};

function queryString(filters?: ChangeFilters): string {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.significance) params.set("significance", filters.significance);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// GET /api/changes — the intelligence feed across all competitors.
export async function listFeed(filters?: ChangeFilters): Promise<ChangeEvent[]> {
  const res = await fetch(`${API_URL}/api/changes${queryString(filters)}`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ changes: ChangeEvent[] }>(res)).changes;
}

// GET /api/competitors/:id/changes — detected changes for one competitor.
export async function listCompetitorChanges(
  competitorId: string,
  filters?: ChangeFilters
): Promise<ChangeEvent[]> {
  const res = await fetch(
    `${API_URL}/api/competitors/${competitorId}/changes${queryString(filters)}`,
    { credentials: "include", cache: "no-store" }
  );
  return (await handleResponse<{ changes: ChangeEvent[] }>(res)).changes;
}
