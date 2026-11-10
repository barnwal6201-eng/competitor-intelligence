import type { Competitor, CompetitorInput } from "@/types";

// All competitor API communication lives here, separate from UI components
// (PRD section 19). Every call sends the httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export async function listCompetitors(params?: {
  search?: string;
  monitoring?: "all" | "enabled" | "paused";
}): Promise<Competitor[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.monitoring && params.monitoring !== "all") query.set("monitoring", params.monitoring);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_URL}/api/competitors${suffix}`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ competitors: Competitor[] }>(res)).competitors;
}

export async function getCompetitor(id: string): Promise<Competitor> {
  const res = await fetch(`${API_URL}/api/competitors/${id}`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ competitor: Competitor }>(res)).competitor;
}

export async function createCompetitor(input: CompetitorInput): Promise<Competitor> {
  const res = await fetch(`${API_URL}/api/competitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  return (await handleResponse<{ competitor: Competitor }>(res)).competitor;
}

export async function updateCompetitor(
  id: string,
  input: Partial<CompetitorInput>
): Promise<Competitor> {
  const res = await fetch(`${API_URL}/api/competitors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  return (await handleResponse<{ competitor: Competitor }>(res)).competitor;
}

export async function deleteCompetitor(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/competitors/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await handleResponse<{ ok: boolean }>(res);
}
