import type { Analysis } from "@/types";

// AI analysis API calls (Phase 6). Every call sends the httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export type AnalyzeResult = {
  analysis: Analysis | null;
  message?: string;
};

// POST /api/competitors/:id/analyze — analyse the newest unanalysed
// changes (or exactly the changeIds given). Returns analysis: null with
// a message when there is nothing new to analyse.
export async function analyzeCompetitor(
  competitorId: string,
  changeIds?: string[]
): Promise<AnalyzeResult> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/analyze`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changeIds ? { changeIds } : {}),
  });
  return handleResponse<AnalyzeResult>(res);
}

// GET /api/competitors/:id/analyses — analysis history, newest first.
export async function listAnalyses(competitorId: string): Promise<Analysis[]> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/analyses`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ analyses: Analysis[] }>(res)).analyses;
}
