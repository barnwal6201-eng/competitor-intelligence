import { fetchAndLoad } from "./common";
import type { ReviewItem, ScrapeResult } from "./types";

// ReviewsScraper (PRD section 9): extracts review text and rating from a
// review source page.
//
// Reviews have no standard layout either, so the scraper looks for
// review-like containers (class names containing "review", "rating" or
// "testimonial") and reads a rating from nearby text — "4.5 out of 5",
// "4.5/5", or a row of ★ characters. The average is computed only from
// reviews that actually carry a rating.

const RATING_RE = /(\d(?:\.\d)?)\s*(?:out of\s*5|\/\s*5)/i;

function ratingFromText(text: string): number | null {
  const m = RATING_RE.exec(text);
  if (m) return Number(m[1]);
  const stars = (text.match(/★/g) || []).length;
  const emptyStars = (text.match(/☆/g) || []).length;
  if (stars > 0 && stars + emptyStars <= 5) return stars;
  return null;
}

export async function scrapeReviews(url: string): Promise<ScrapeResult> {
  const { $, text } = await fetchAndLoad(url);
  const reviews: ReviewItem[] = [];
  const seen = new Set<string>();

  function addReview(reviewText: string, context: string) {
    const clean = reviewText.replace(/\s+/g, " ").trim();
    if (clean.length < 20 || clean.length > 2000) return;
    const key = clean.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    reviews.push({ text: clean.slice(0, 1000), rating: ratingFromText(context) });
  }

  // 1. Review-like containers.
  $("[class*='review'], [class*='testimonial']").each((_, el) => {
    const block = $(el);
    const reviewText = block.find("p, blockquote").first().text() || block.text();
    addReview(reviewText, block.text());
  });

  // 2. Fallback: blockquotes anywhere on the page.
  if (reviews.length === 0) {
    $("blockquote").each((_, el) => {
      const block = $(el);
      addReview(block.text(), block.parent().text());
    });
  }

  const rated = reviews.filter((r) => r.rating !== null) as { rating: number }[];
  const averageRating =
    rated.length > 0
      ? Math.round((rated.reduce((sum, r) => sum + r.rating, 0) / rated.length) * 10) / 10
      : null;

  return {
    sourceType: "reviews",
    sourceUrl: url,
    data: { reviews, averageRating },
    normalizedText: text,
  };
}
