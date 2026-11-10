import { fetchAndLoad } from "./common";
import type { PricePlan, ScrapeResult } from "./types";

// PricingScraper (PRD section 9): extracts plan name, price, billing
// interval, and currency from a pricing page.
//
// Pricing pages have no standard layout, so the scraper looks for price-like
// text anywhere on the page — "$29", "₹999", "€49/mo", "USD 199/year" —
// and takes the closest heading as the plan name. Anything it cannot parse
// is returned as a plan with price null rather than dropped, so a reviewer
// can see what the page actually said.
//
// To avoid reporting the same price several times (a price inside a <p>
// inside a plan card inside a pricing section), only "leaf" price elements
// are used: elements whose own text contains a price but none of whose
// children do. The plan name is then the closest heading in an ancestor.

const PRICE_RE =
  /(₹|\$|€|£|Rs\.?|USD|EUR|GBP)\s?([\d,]+(?:\.\d{1,2})?)/gi;

const INTERVAL_RE = /\b(per\s+month|\/mo\b|\/month|monthly|per\s+year|\/yr\b|\/year|yearly|annual|one-?time|lifetime)\b/i;

function detectInterval(text: string): PricePlan["interval"] {
  const m = INTERVAL_RE.exec(text);
  if (!m) return "unknown";
  const v = m[1].toLowerCase();
  if (v.includes("month") || v === "/mo") return "month";
  if (v.includes("year") || v === "/yr" || v.includes("annual")) return "year";
  if (v.includes("one-time") || v.includes("lifetime")) return "one-time";
  return "unknown";
}

function normalizeCurrency(symbol: string): string | null {
  const s = symbol.replace(".", "").trim().toUpperCase();
  if (s === "$" || s === "USD") return "USD";
  if (s === "₹" || s === "RS") return "INR";
  if (s === "€" || s === "EUR") return "EUR";
  if (s === "£" || s === "GBP") return "GBP";
  return s || null;
}

export async function scrapePricing(url: string): Promise<ScrapeResult> {
  const { $, text } = await fetchAndLoad(url);
  const plans: PricePlan[] = [];
  const seen = new Set<string>();

  function addPlan(name: string, price: number, currency: string | null, interval: PricePlan["interval"], raw: string) {
    const key = `${name}|${price}|${currency}|${interval}`;
    if (seen.has(key)) return;
    seen.add(key);
    plans.push({ name, price, currency, interval, raw });
  }

  // Leaf price elements: contain a price, but no child element does.
  $("body *").each((_, el) => {
    const element = $(el);
    const ownText = element
      .contents()
      .filter((_, node) => node.type === "text")
      .text();
    if (!PRICE_RE.test(ownText)) {
      PRICE_RE.lastIndex = 0;
      return;
    }
    PRICE_RE.lastIndex = 0;
    // A child also holds a price: this element is a container, skip it.
    let childHasPrice = false;
    element.children().each((_, child) => {
      if (PRICE_RE.test($(child).text())) childHasPrice = true;
      PRICE_RE.lastIndex = 0;
    });
    if (childHasPrice) return;

    // Plan name: the closest heading in this element or an ancestor.
    let container = element;
    while (container.length > 0 && container.find("h1, h2, h3, h4").length === 0) {
      container = container.parent();
    }
    const heading = container.find("h1, h2, h3, h4").first().text().trim();
    const context = element.parent().text().replace(/\s+/g, " ").trim();

    let match: RegExpExecArray | null;
    PRICE_RE.lastIndex = 0;
    while ((match = PRICE_RE.exec(ownText)) !== null) {
      const price = Number(match[2].replace(/,/g, ""));
      if (!Number.isFinite(price)) continue;
      addPlan(
        heading || "Plan",
        price,
        normalizeCurrency(match[1]),
        detectInterval(context),
        match[0]
      );
    }
  });

  // Fallback: no leaf element matched — report every price on the page
  // once, so the snapshot still records what the page said.
  if (plans.length === 0) {
    let match: RegExpExecArray | null;
    PRICE_RE.lastIndex = 0;
    while ((match = PRICE_RE.exec(text)) !== null) {
      const price = Number(match[2].replace(/,/g, ""));
      if (!Number.isFinite(price)) continue;
      addPlan("Plan", price, normalizeCurrency(match[1]), detectInterval(text), match[0]);
    }
  }

  return { sourceType: "pricing", sourceUrl: url, data: { plans }, normalizedText: text };
}
