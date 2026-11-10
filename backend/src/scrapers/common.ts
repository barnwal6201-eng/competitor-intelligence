import * as cheerio from "cheerio";
import { fetchHtml, normalizeText } from "./fetcher";

// Shared helpers for the scrapers (PRD section 9).
// No scraper assumes a particular site's HTML structure: each one looks for
// common patterns (price-like text, headings, dates, links) and returns
// whatever it can find, instead of failing on an unfamiliar layout.

export function loadPage(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export function visibleText($: cheerio.CheerioAPI): string {
  // Drop content a reader never sees before taking the text.
  $("script, style, noscript, svg, head").remove();
  return normalizeText($("body").text());
}

export function absoluteUrl(base: string, href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function fetchAndLoad(url: string): Promise<{ $: cheerio.CheerioAPI; text: string }> {
  const html = await fetchHtml(url);
  const $ = loadPage(html);
  return { $, text: visibleText($) };
}
