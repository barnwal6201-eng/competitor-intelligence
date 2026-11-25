// One place that turns NEXT_PUBLIC_API_URL into a usable base URL.
// All frontend service files read it through here (never directly from
// process.env), so the rule lives in one spot.
//
// Render's Blueprint wires NEXT_PUBLIC_API_URL from the API service's
// hostname — a bare host like xxx.onrender.com with no protocol — and
// fetch needs a full URL, so https:// is added when no protocol is
// present. Local dev keeps working because http://localhost:5000
// already has a protocol. A trailing slash is stripped so callers can
// safely append "/api/..." paths.
export function resolveApiUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000")
    .trim()
    .replace(/\/+$/, "");
  return raw.includes("://") ? raw : `https://${raw}`;
}
