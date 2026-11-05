// Tiny cookie parser for the auth middleware. No extra dependency needed:
// the only cookie this API reads is the httpOnly auth token.
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) out[name] = decodeURIComponent(rest.join("="));
  }
  return out;
}
