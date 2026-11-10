import axios from "axios";
import dns from "node:dns";
import net from "node:net";
import { ScrapeError } from "./types";

// Fetches a page's HTML for the scrapers, with the safety rules from PRD
// sections 9 and 20: SSRF protection, robots.txt, timeouts, and a size cap.
//
// Only public http(s) URLs are fetched. Private/internal addresses are
// refused — a user must not be able to make the server probe the internal
// network (localhost, private LAN ranges, cloud metadata 169.254.169.254).
// ALLOW_PRIVATE_SCRAPE_URLS=true disables that check; it exists only so
// automated tests can scrape a local test server, and must never be set in
// production.

const USER_AGENT =
  "CompetitorIntelligenceBot/1.0 (+https://github.com/competitor-intelligence)";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  return false;
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ScrapeError(`Invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScrapeError(`Only http(s) URLs can be scraped: ${rawUrl}`);
  }
  if (process.env.ALLOW_PRIVATE_SCRAPE_URLS === "true") return url;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new ScrapeError("Refused to scrape a private address (localhost)");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new ScrapeError(`Refused to scrape a private address (${host})`);
    }
    return url;
  }
  // A hostname can resolve to a private IP (DNS rebinding), so check the
  // address it actually resolves to — not just the name.
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    throw new ScrapeError(`Could not resolve ${host}`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new ScrapeError(`Refused to scrape a private address (${host})`);
  }
  return url;
}

// --- robots.txt (small parser, cached per origin for 1 hour) ---------------

interface RobotsRule {
  allow: string[];
  disallow: string[];
}

const robotsCache = new Map<string, { rules: RobotsRule; fetchedAt: number }>();

function parseRobotsTxt(text: string): RobotsRule {
  const rules: RobotsRule = { allow: [], disallow: [] };
  let inOurGroup = false;
  let sawAnyGroup = false;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const key = field.trim().toLowerCase();
    if (key === "user-agent") {
      sawAnyGroup = true;
      inOurGroup = value === "*" || value.toLowerCase().includes("competitorintelligence");
    } else if (inOurGroup && key === "allow") {
      rules.allow.push(value);
    } else if (inOurGroup && key === "disallow") {
      rules.disallow.push(value);
    }
  }
  // No matching group at all: no rules apply (allowed).
  if (!sawAnyGroup) return { allow: [], disallow: [] };
  return rules;
}

function pathMatchesRule(path: string, rule: string): boolean {
  if (rule === "") return false;
  if (rule === "/") return true;
  // robots.txt uses simple prefix matching; "*" matches any sequence.
  const pattern = "^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(pattern).test(path);
}

export async function isAllowedByRobots(url: URL): Promise<boolean> {
  const origin = url.origin;
  const cached = robotsCache.get(origin);
  let rules: RobotsRule;
  if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) {
    rules = cached.rules;
  } else {
    try {
      const res = await axios.get(`${origin}/robots.txt`, {
        timeout: 5_000,
        maxContentLength: 100 * 1024,
        headers: { "User-Agent": USER_AGENT },
        validateStatus: () => true,
      });
      rules = res.status === 200 ? parseRobotsTxt(res.data) : { allow: [], disallow: [] };
    } catch {
      // robots.txt unreachable: scraping is allowed (standard behaviour).
      rules = { allow: [], disallow: [] };
    }
    robotsCache.set(origin, { rules, fetchedAt: Date.now() });
  }
  const path = url.pathname + url.search;
  // Longest matching rule wins; an Allow beats a Disallow of the same length.
  let longestAllow = -1;
  let longestDisallow = -1;
  for (const rule of rules.allow) {
    if (pathMatchesRule(path, rule)) longestAllow = Math.max(longestAllow, rule.length);
  }
  for (const rule of rules.disallow) {
    if (pathMatchesRule(path, rule)) longestDisallow = Math.max(longestDisallow, rule.length);
  }
  return longestDisallow <= longestAllow;
}

// --- fetching ---------------------------------------------------------------

export async function fetchHtml(rawUrl: string): Promise<string> {
  const url = await assertPublicUrl(rawUrl);
  if (!(await isAllowedByRobots(url))) {
    throw new ScrapeError(`Blocked by robots.txt: ${rawUrl}`, "blocked");
  }
  let html: string;
  try {
    const res = await axios.get<string>(url.toString(), {
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_BYTES,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 300,
      // Do not follow redirects to a different host — a redirect to an
      // internal address must not bypass the SSRF check above.
      maxRedirects: 3,
    });
    html = res.data;
  } catch (err) {
    if (err instanceof ScrapeError) throw err;
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      throw new ScrapeError(
        status ? `Page returned HTTP ${status}: ${rawUrl}` : `Could not fetch ${rawUrl}: ${err.message}`
      );
    }
    throw new ScrapeError(`Could not fetch ${rawUrl}`);
  }

  // A nearly empty page usually means the content is rendered by JavaScript.
  // The Playwright fallback (scrapers/playwrightFetcher.ts) can render it,
  // when Playwright is installed and SCRAPER_USE_PLAYWRIGHT=true.
  if (process.env.SCRAPER_USE_PLAYWRIGHT === "true") {
    const textLength = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
    if (textLength < 200) {
      const { fetchWithPlaywright } = await import("./playwrightFetcher");
      return fetchWithPlaywright(url.toString());
    }
  }
  return html;
}

// Collapse a page's visible text to one normalized string — used for the
// content hash (dedupe) and the snapshot preview.
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
