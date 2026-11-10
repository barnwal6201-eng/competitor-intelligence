// Optional JavaScript-rendered fallback (PRD section 9).
//
// Playwright is intentionally NOT a dependency of the backend: it needs a
// browser download that is heavy on a first install. This module is only
// loaded when the fetcher decides a page needs rendering
// (SCRAPER_USE_PLAYWRIGHT=true and the static HTML has almost no text).
// To enable it:
//
//   npm install playwright
//   npx playwright install chromium
//
// If Playwright is not installed, the dynamic import throws, the caller
// turns it into a clear error, and the scan records the page as failed
// instead of crashing the server. (The module shape is declared in
// src/types/playwright.d.ts so TypeScript accepts the import.)

export async function fetchWithPlaywright(url: string): Promise<string> {
  let chromium: import("playwright").Chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not installed — run `npm install playwright` and `npx playwright install chromium` to enable JavaScript-rendered scraping"
    );
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}
