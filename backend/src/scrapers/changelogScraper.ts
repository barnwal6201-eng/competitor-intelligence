import { fetchAndLoad } from "./common";
import type { ChangelogEntry, ScrapeResult } from "./types";

// ChangelogScraper (PRD section 9): extracts feature title, description,
// and publication date from a changelog / "what's new" page.
//
// Entries are found three ways, in order: <article> elements, elements with
// a changelog-like class, and headings that sit next to a <time> element or
// a date-like string. Dates are read from <time datetime="..."> first, then
// from date-shaped text (2026-11-07, Nov 7 2026, 7 Nov 2026).

const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i;

function findDate(text: string): string | null {
  const m = DATE_RE.exec(text);
  return m ? m[0] : null;
}

export async function scrapeChangelog(url: string): Promise<ScrapeResult> {
  const { $, text } = await fetchAndLoad(url);
  const entries: ChangelogEntry[] = [];
  const seen = new Set<string>();

  function addEntry(title: string, date: string | null, description: string) {
    const cleanTitle = title.replace(/\s+/g, " ").trim();
    if (!cleanTitle || cleanTitle.length > 200) return;
    const key = `${cleanTitle}|${date ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      title: cleanTitle,
      date,
      description: description.replace(/\s+/g, " ").trim().slice(0, 500),
    });
  }

  // 1. <article> blocks — the most common changelog structure.
  $("article").each((_, el) => {
    const block = $(el);
    const title = block.find("h1, h2, h3, h4").first().text();
    const time = block.find("time").first();
    const date = time.attr("datetime") || time.text().trim() || findDate(block.text());
    const description = block.find("p").first().text() || block.text();
    addEntry(title, date || null, description);
  });

  // 2. Headings next to a <time> element.
  $("time").each((_, el) => {
    const time = $(el);
    const date = time.attr("datetime") || time.text().trim();
    const parent = time.parent();
    const title = parent.find("h1, h2, h3, h4").first().text() || parent.text().split("\n")[0];
    const description = parent.find("p").first().text() || parent.text();
    addEntry(title, date || null, description);
  });

  // 3. Fallback: every h2/h3 on the page with a date nearby or none.
  if (entries.length === 0) {
    $("h2, h3").each((_, el) => {
      const heading = $(el);
      const title = heading.text();
      const context = heading.parent().text();
      const date = findDate(context);
      const description = heading.next("p").text() || heading.parent().find("p").first().text();
      addEntry(title, date, description);
    });
  }

  return { sourceType: "changelog", sourceUrl: url, data: { entries }, normalizedText: text };
}
