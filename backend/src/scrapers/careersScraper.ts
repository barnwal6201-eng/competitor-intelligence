import { fetchAndLoad, absoluteUrl } from "./common";
import type { JobListing, ScrapeResult } from "./types";

// CareersScraper (PRD section 9): extracts job title, department/location,
// and posting link from a careers page.
//
// Job boards have no standard layout, so the scraper looks for job-like
// containers first (class names containing "job", "career", "position" or
// "opening"), then falls back to links whose text looks like a job title and
// whose href mentions jobs/careers. Locations are read from nearby text
// that looks like "City, Country" or "Remote".

const LOCATION_RE = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z][a-z]+|Remote|Hybrid|On-site)\b/;

export async function scrapeCareers(url: string): Promise<ScrapeResult> {
  const { $, text } = await fetchAndLoad(url);
  const jobs: JobListing[] = [];
  const seen = new Set<string>();

  function addJob(title: string, context: string, href?: string) {
    const cleanTitle = title.replace(/\s+/g, " ").trim();
    if (!cleanTitle || cleanTitle.length < 3 || cleanTitle.length > 120) return;
    const locationMatch = LOCATION_RE.exec(context);
    const key = `${cleanTitle}|${locationMatch?.[0] ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    jobs.push({
      title: cleanTitle,
      location: locationMatch ? locationMatch[0] : null,
      url: absoluteUrl(url, href),
    });
  }

  // 1. Job-like containers.
  $("[class*='job'], [class*='career'], [class*='position'], [class*='opening']").each((_, el) => {
    const block = $(el);
    const title = block.find("h1, h2, h3, h4, a").first().text();
    const link = block.find("a").first().attr("href");
    addJob(title, block.text(), link);
  });

  // 2. Fallback: links that look like job postings.
  if (jobs.length === 0) {
    $("a[href]").each((_, el) => {
      const link = $(el);
      const href = link.attr("href") || "";
      const title = link.text();
      if (/job|career|position|opening|apply/i.test(href) && title.trim().length > 3) {
        addJob(title, link.parent().text(), href);
      }
    });
  }

  return { sourceType: "careers", sourceUrl: url, data: { jobs }, normalizedText: text };
}
