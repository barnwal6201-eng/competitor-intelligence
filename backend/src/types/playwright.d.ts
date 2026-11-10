// Optional dependency: Playwright is NOT installed by default (see
// scrapers/playwrightFetcher.ts). This declaration lets TypeScript accept the
// dynamic import without the package being present; at runtime the import
// throws if Playwright was never installed, and the fetcher reports that
// clearly instead of crashing.
declare module "playwright" {
  export const chromium: {
    launch: (options: { headless: boolean }) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options: { waitUntil: string; timeout: number }) => Promise<void>;
        content: () => Promise<string>;
      }>;
      close: () => Promise<void>;
    }>;
  };
  export type Chromium = typeof chromium;
}
