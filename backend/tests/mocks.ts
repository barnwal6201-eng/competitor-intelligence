// Phase 11 test suite — mock servers (plain node:http, no new deps).
//   MockSite       fake competitor website the real scrapers can parse.
//   MockGroq       fake Groq Chat Completions endpoint (ok / invalid JSON /
//                    wrong shape / 401 modes) for AI analysis tests.
//   MockNotion     fake Notion API (OAuth token exchange + page create).
//   MockSalesforce fake Salesforce (OAuth token exchange + refresh + Task).
// All listen on 0.0.0.0 so the same server is reachable as 127.0.0.1
// (scraping, with ALLOW_PRIVATE_SCRAPE_URLS=true) and, where needed,
// through other local addresses.
import http from "node:http";

export interface MockHandle {
  port: number;
  close(): Promise<void>;
}

// ---------------------------------------------------------------- fake site
export interface Plan {
  name: string;
  price: number | null;
}
export interface ChangelogEntry {
  title: string;
  date: string;
  desc: string;
}
export interface Job {
  title: string;
  location: string;
}
export interface Review {
  text: string;
  rating: number;
}

export interface MockSite extends MockHandle {
  plans: Plan[];
  entries: ChangelogEntry[];
  jobs: Job[];
  reviews: Review[];
  requests: string[];
  setPlans(plans: Plan[]): void;
  setPrice(name: string, price: number): void;
  addPlan(name: string, price: number): void;
  removePlan(name: string): void;
  addEntry(e: ChangelogEntry): void;
  addJob(j: Job): void;
  addReview(r: Review): void;
  reset(): void;
}

export const BASELINE_PLANS: Plan[] = [
  { name: "Starter", price: 10 },
  { name: "Pro", price: 29 },
  { name: "Enterprise", price: 99 },
];
export const BASELINE_ENTRIES: ChangelogEntry[] = [
  { title: "Dashboard refresh", date: "2026-11-01", desc: "A faster dashboard with new filters." },
];
export const BASELINE_JOBS: Job[] = [{ title: "Support Engineer", location: "Remote" }];
export const BASELINE_REVIEWS: Review[] = [
  { text: "Great product, our team loves the new dashboard and support is fast.", rating: 5 },
];

function pricingHtml(plans: Plan[]): string {
  const cards = plans
    .map(
      (p) =>
        `<div class="plan"><h2>${p.name}</h2><p class="price">${p.price === null ? "Contact sales" : `$${p.price}/month`}</p></div>`
    )
    .join("\n");
  return `<html><head><title>Acme Pricing</title></head><body><h1>Acme Pricing</h1>${cards}</body></html>`;
}

function changelogHtml(entries: ChangelogEntry[]): string {
  const items = entries
    .map(
      (e) =>
        `<article><h2>${e.title}</h2><time datetime="${e.date}">${e.date}</time><p>${e.desc}</p></article>`
    )
    .join("\n");
  return `<html><head><title>Acme Changelog</title></head><body><h1>Changelog</h1>${items}</body></html>`;
}

function careersHtml(jobs: Job[]): string {
  const items = jobs
    .map(
      (j) =>
        `<div class="job-listing"><h3>${j.title}</h3><p>${j.location}</p><a href="/jobs/apply">Apply</a></div>`
    )
    .join("\n");
  return `<html><head><title>Acme Careers</title></head><body><h1>Careers</h1>${items}</body></html>`;
}

function reviewsHtml(reviews: Review[]): string {
  const items = reviews
    .map(
      (r) =>
        `<div class="review"><p>${r.text}</p><span>${r.rating} out of 5</span></div>`
    )
    .join("\n");
  return `<html><head><title>Acme Reviews</title></head><body><h1>Reviews</h1>${items}</body></html>`;
}

export function startMockSite(port: number): Promise<MockSite> {
  const state = {
    plans: structuredClone(BASELINE_PLANS),
    entries: structuredClone(BASELINE_ENTRIES),
    jobs: structuredClone(BASELINE_JOBS),
    reviews: structuredClone(BASELINE_REVIEWS),
    requests: [] as string[],
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    state.requests.push(`${req.method} ${url.pathname}`);
    const send = (code: number, body: string, type = "text/html") => {
      res.writeHead(code, { "Content-Type": type });
      res.end(body);
    };
    if (url.pathname === "/robots.txt") {
      send(200, "User-agent: *\nDisallow: /blocked-pricing\n", "text/plain");
      return;
    }
    if (url.pathname === "/redirect-private") {
      // 302 to a private address: the fetcher must refuse the hop.
      res.writeHead(302, { Location: "http://127.0.0.1:9/private-target" });
      res.end();
      return;
    }
    if (url.pathname === "/pricing" || url.pathname === "/blocked-pricing" || url.pathname === "/") {
      send(200, pricingHtml(state.plans));
      return;
    }
    if (url.pathname === "/changelog") {
      send(200, changelogHtml(state.entries));
      return;
    }
    if (url.pathname === "/careers") {
      send(200, careersHtml(state.jobs));
      return;
    }
    if (url.pathname === "/reviews") {
      send(200, reviewsHtml(state.reviews));
      return;
    }
    send(404, "not found", "text/plain");
  });
  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      resolve({
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
        get plans() {
          return state.plans;
        },
        get entries() {
          return state.entries;
        },
        get jobs() {
          return state.jobs;
        },
        get reviews() {
          return state.reviews;
        },
        get requests() {
          return state.requests;
        },
        setPlans(plans) {
          state.plans = structuredClone(plans);
        },
        setPrice(name, price) {
          const p = state.plans.find((x) => x.name === name);
          if (p) p.price = price;
        },
        addPlan(name, price) {
          state.plans.push({ name, price });
        },
        removePlan(name) {
          state.plans = state.plans.filter((x) => x.name !== name);
        },
        addEntry(e) {
          state.entries.push(e);
        },
        addJob(j) {
          state.jobs.push(j);
        },
        addReview(r) {
          state.reviews.push(r);
        },
        reset() {
          state.plans = structuredClone(BASELINE_PLANS);
          state.entries = structuredClone(BASELINE_ENTRIES);
          state.jobs = structuredClone(BASELINE_JOBS);
          state.reviews = structuredClone(BASELINE_REVIEWS);
          state.requests = [];
        },
      });
    });
  });
}

// ---------------------------------------------------------------- mock Groq
export type GroqMode = "ok" | "invalid-json" | "wrong-shape" | "unauthorized" | "empty";

export interface MockGroq extends MockHandle {
  mode: GroqMode;
  calls: number;
  lastBody: any;
}

const GOOD_ANALYSIS = {
  summary: "Acme raised the Pro plan price and added a new Team plan, while shipping an AI feature.",
  implications: ["Acme is moving upmarket with higher Pro pricing."],
  strengths: ["Acme ships features quickly."],
  weaknesses: ["Higher prices may push price-sensitive teams away."],
  suggestedResponses: ["Emphasise our flat pricing with no per-seat surprises."],
  talkingPoints: ["Acme Pro is now $39/month, up from $29."],
  confidence: "medium",
};

export function startMockGroq(port: number): Promise<MockGroq> {
  const state: { mode: GroqMode; calls: number; lastBody: any } = { mode: "ok", calls: 0, lastBody: null };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/chat/completions" && req.method === "POST") {
        state.calls++;
        try {
          state.lastBody = JSON.parse(body);
        } catch {
          state.lastBody = null;
        }
        const json = (code: number, payload: unknown) => {
          res.writeHead(code, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        };
        if (state.mode === "unauthorized") return json(401, { error: { message: "bad key" } });
        if (state.mode === "invalid-json") {
          return json(200, {
            choices: [{ message: { content: "this is not json at all" } }],
            model: "openai/gpt-oss-120b",
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          });
        }
        if (state.mode === "wrong-shape") {
          return json(200, {
            choices: [{ message: { content: JSON.stringify({ summary: "too short" }) } }],
            model: "openai/gpt-oss-120b",
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          });
        }
        if (state.mode === "empty") {
          return json(200, { choices: [{ message: { content: "" } }], model: "openai/gpt-oss-120b" });
        }
        return json(200, {
          choices: [{ message: { content: JSON.stringify(GOOD_ANALYSIS) } }],
          model: "openai/gpt-oss-120b",
          usage: { prompt_tokens: 120, completion_tokens: 80 },
        });
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      resolve({
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
        get mode() {
          return state.mode;
        },
        set mode(m: GroqMode) {
          state.mode = m;
        },
        get calls() {
          return state.calls;
        },
        get lastBody() {
          return state.lastBody;
        },
      });
    });
  });
}

// ---------------------------------------------------------------- mock Notion
export interface MockNotion extends MockHandle {
  pages: any[];
  tokenExchanges: number;
}

export function startMockNotion(port: number): Promise<MockNotion> {
  const state: { pages: any[]; tokenExchanges: number } = { pages: [], tokenExchanges: 0 };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (code: number, payload: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (req.url === "/v1/oauth/token" && req.method === "POST") {
        state.tokenExchanges++;
        return json(200, {
          access_token: "mock-notion-token-abc",
          workspace_id: "ws-mock-1",
          workspace_name: "Mock Workspace",
          bot_id: "bot-mock-1",
        });
      }
      if (req.url === "/v1/pages" && req.method === "POST") {
        let parsed: any = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = null;
        }
        state.pages.push(parsed);
        return json(200, { id: "page-mock-1", url: "https://notion.so/mock-page-1" });
      }
      return json(404, { error: "not found" });
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      resolve({
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
        get pages() {
          return state.pages;
        },
        get tokenExchanges() {
          return state.tokenExchanges;
        },
      });
    });
  });
}

// ---------------------------------------------------------------- mock Salesforce
export interface MockSalesforce extends MockHandle {
  tokenRequests: { grant_type: string }[];
  tasks: { subject: string; description: string; auth: string }[];
}

export function startMockSalesforce(port: number): Promise<MockSalesforce> {
  const state: { tokenRequests: { grant_type: string }[]; tasks: { subject: string; description: string; auth: string }[] } = {
    tokenRequests: [],
    tasks: [],
  };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (code: number, payload: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (req.url === "/services/oauth2/token" && req.method === "POST") {
        const params = new URLSearchParams(body);
        const grant = params.get("grant_type") ?? "";
        state.tokenRequests.push({ grant_type: grant });
        if (grant === "refresh_token") {
          return json(200, {
            access_token: "mock-sf-token-v2",
            refresh_token: "mock-sf-refresh-2",
            instance_url: `http://127.0.0.1:${port}`,
            id: `http://127.0.0.1:${port}/id/00Dmock/005mock`,
            expires_in: 3600,
          });
        }
        return json(200, {
          access_token: "mock-sf-token-v1",
          refresh_token: "mock-sf-refresh-1",
          instance_url: `http://127.0.0.1:${port}`,
          id: `http://127.0.0.1:${port}/id/00Dmock/005mock`,
          expires_in: 3600,
        });
      }
      if (req.url === "/services/data/v59.0/sobjects/Task" && req.method === "POST") {
        let parsed: any = {};
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = {};
        }
        state.tasks.push({
          subject: parsed.Subject ?? "",
          description: parsed.Description ?? "",
          auth: req.headers.authorization ?? "",
        });
        return json(201, { id: "task-mock-1", success: true });
      }
      return json(404, { error: "not found" });
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      resolve({
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
        get tokenRequests() {
          return state.tokenRequests;
        },
        get tasks() {
          return state.tasks;
        },
      });
    });
  });
}
