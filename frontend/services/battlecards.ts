import type {
  Battlecard,
  BattlecardListItem,
  BattlecardVersionDetail,
  BattlecardVersionInfo,
} from "@/types";

// Battlecard API calls (Phase 7). Every call sends the httpOnly auth cookie.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as T;
}

export type BattlecardEdit = {
  overview?: string;
  positioning?: string;
  strengths?: string[];
  weaknesses?: string[];
  talkingPoints?: string[];
  objectionHandling?: string[];
};

// GET /api/battlecards — every battlecard in the organization.
export async function listBattlecards(): Promise<BattlecardListItem[]> {
  const res = await fetch(`${API_URL}/api/battlecards`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ battlecards: BattlecardListItem[] }>(res)).battlecards;
}

// GET /api/competitors/:id/battlecard — the current version.
export async function getBattlecard(competitorId: string): Promise<Battlecard> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/battlecard`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ battlecard: Battlecard }>(res)).battlecard;
}

// POST /api/competitors/:id/battlecard/generate — first version.
export async function generateBattlecard(
  competitorId: string
): Promise<{ battlecard: Battlecard; message?: string }> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/battlecard/generate`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<{ battlecard: Battlecard; message?: string }>(res);
}

// POST /api/competitors/:id/battlecard/regenerate — rebuild from latest data.
export async function regenerateBattlecard(
  competitorId: string
): Promise<{ battlecard: Battlecard; message?: string }> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/battlecard/regenerate`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse<{ battlecard: Battlecard; message?: string }>(res);
}

// PUT /api/competitors/:id/battlecard — edit the editable sections.
export async function updateBattlecard(
  competitorId: string,
  edit: BattlecardEdit
): Promise<Battlecard> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/battlecard`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });
  return (await handleResponse<{ battlecard: Battlecard }>(res)).battlecard;
}

// GET /api/competitors/:id/battlecard/versions — version list.
export async function listBattlecardVersions(
  competitorId: string
): Promise<BattlecardVersionInfo[]> {
  const res = await fetch(`${API_URL}/api/competitors/${competitorId}/battlecard/versions`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await handleResponse<{ versions: BattlecardVersionInfo[] }>(res)).versions;
}

// GET /api/competitors/:id/battlecard/versions/:version — one frozen version.
export async function getBattlecardVersion(
  competitorId: string,
  version: number
): Promise<BattlecardVersionDetail> {
  const res = await fetch(
    `${API_URL}/api/competitors/${competitorId}/battlecard/versions/${version}`,
    { credentials: "include", cache: "no-store" }
  );
  return (await handleResponse<{ version: BattlecardVersionDetail }>(res)).version;
}
