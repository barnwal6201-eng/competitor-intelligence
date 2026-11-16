import type { DashboardOverview } from "@/types";

// Dashboard API calls (Phase 8). Every call sends the httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

// GET /api/dashboard/overview — stats, 14-day trend, top competitors,
// price moves, recent changes, and per-competitor scan health.
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await fetch(`${API_URL}/api/dashboard/overview`, {
    credentials: "include",
    cache: "no-store",
  });
  return handleResponse<DashboardOverview>(res);
}
