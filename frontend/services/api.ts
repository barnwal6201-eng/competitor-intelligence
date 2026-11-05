import type { BackendHealth } from "@/types";

// All API communication lives here, separate from UI components (PRD section 19).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function getApiUrl(): string {
  return API_URL;
}

export async function getBackendHealth(): Promise<BackendHealth> {
  const res = await fetch(`${API_URL}/api/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`);
  }
  return res.json();
}
