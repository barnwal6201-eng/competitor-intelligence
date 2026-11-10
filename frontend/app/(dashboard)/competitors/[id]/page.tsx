"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getCompetitor } from "@/services/competitors";
import { listSnapshots, triggerScan } from "@/services/scans";
import { listCompetitorChanges } from "@/services/changes";
import ChangeCard from "@/components/ChangeCard";
import type { ChangeEvent, Competitor, ScanSummary, Snapshot } from "@/types";

function sourceLabel(type: Snapshot["sourceType"]): string {
  return { pricing: "Pricing", changelog: "Changelog", careers: "Careers", reviews: "Reviews" }[type];
}

function outcomeLabel(outcome: string): string {
  return { created: "New snapshot", unchanged: "Unchanged", failed: "Failed", blocked: "Blocked" }[outcome] ?? outcome;
}

// One line summarising what the scraper actually found in a snapshot.
function snapshotSummary(s: Snapshot): string {
  if (s.status !== "success") return s.errorMessage || s.status;
  const data = (s.extractedData ?? {}) as Record<string, unknown>;
  if (s.sourceType === "pricing" && Array.isArray(data.plans)) {
    const plans = data.plans as { name: string; price: number | null; currency: string | null; raw: string }[];
    if (plans.length === 0) return "No prices found on the page";
    const priced = plans.filter((p) => p.price !== null);
    const cheapest = priced.length > 0 ? priced.reduce((a, b) => (a.price! < b.price! ? a : b)) : null;
    return `${plans.length} plan${plans.length === 1 ? "" : "s"} found` +
      (cheapest ? ` — cheapest: ${cheapest.raw} (${cheapest.name})` : "");
  }
  if (s.sourceType === "changelog" && Array.isArray(data.entries)) {
    const entries = data.entries as { title: string; date: string | null }[];
    if (entries.length === 0) return "No changelog entries found";
    return `${entries.length} ${entries.length === 1 ? "entry" : "entries"} — latest: ${entries[0].title}` +
      (entries[0].date ? ` (${entries[0].date})` : "");
  }
  if (s.sourceType === "careers" && Array.isArray(data.jobs)) {
    const jobs = data.jobs as { title: string; location: string | null }[];
    if (jobs.length === 0) return "No job listings found";
    return `${jobs.length} open role${jobs.length === 1 ? "" : "s"} — e.g. ${jobs[0].title}` +
      (jobs[0].location ? ` (${jobs[0].location})` : "");
  }
  if (s.sourceType === "reviews" && Array.isArray(data.reviews)) {
    const reviews = data.reviews as { rating: number | null }[];
    const avg = typeof data.averageRating === "number" ? data.averageRating : null;
    if (reviews.length === 0) return "No reviews found";
    return `${reviews.length} review${reviews.length === 1 ? "" : "s"} found` +
      (avg !== null ? ` — average rating ${avg}/5` : "");
  }
  return "Scraped successfully";
}

// The id comes from useParams() instead of the `params` prop: in Next.js
// 15/16 `params` is a Promise and reading `.id` off it directly crashes,
// while useParams() returns the plain id on every Next.js version.
export default function CompetitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [loadError, setLoadError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummary | null>(null);
  const [scanError, setScanError] = useState("");

  const loadSnapshots = useCallback(async () => {
    setSnapshots(await listSnapshots(id));
  }, [id]);

  const loadChanges = useCallback(async () => {
    setChanges(await listCompetitorChanges(id, { limit: 20 }));
  }, [id]);

  useEffect(() => {
    getCompetitor(id)
      .then((c) => {
        setCompetitor(c);
        return Promise.all([loadSnapshots(), loadChanges()]);
      })
      .catch((err) => {
        if (err instanceof Error && /not signed in/i.test(err.message)) {
          router.push("/login");
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Could not load competitor");
      });
  }, [id, router, loadSnapshots, loadChanges]);

  async function handleScan() {
    setScanning(true);
    setScanError("");
    setScanResult(null);
    try {
      const summary = await triggerScan(id);
      setScanResult(summary);
      await Promise.all([loadSnapshots(), loadChanges()]);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
        <Link href="/competitors" className="mt-4 inline-block font-medium text-indigo-700">
          ← Back to competitors
        </Link>
      </main>
    );
  }
  if (!competitor) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-neutral-600">Loading competitor…</p>
      </main>
    );
  }

  const urls: { label: string; url?: string }[] = [
    { label: "Website", url: competitor.websiteUrl },
    { label: "Pricing page", url: competitor.pricingPageUrl },
    { label: "Changelog", url: competitor.changelogUrl },
    { label: "Careers page", url: competitor.careersPageUrl },
    { label: "Review source", url: competitor.reviewSourceUrl },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-indigo-700">
        <Link href="/competitors" className="hover:underline">← Competitors</Link>
      </p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{competitor.companyName}</h1>
          <a href={competitor.websiteUrl} target="_blank" rel="noreferrer"
            className="text-sm text-indigo-700 hover:underline">
            {competitor.websiteUrl}
          </a>
          <p className="mt-1 text-sm text-neutral-600">
            Checks {competitor.monitoringFrequency} ·{" "}
            {competitor.isMonitoringEnabled ? "Monitoring" : "Paused"} · Added{" "}
            {new Date(competitor.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link
          href={`/competitors/${competitor.id}/edit`}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
        >
          Edit
        </Link>
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-medium">Pages being watched</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {urls.map(({ label, url }) => (
            <li key={label} className="flex gap-2">
              <span className="w-28 shrink-0 font-medium text-neutral-700">{label}</span>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="break-all text-indigo-700 hover:underline">
                  {url}
                </a>
              ) : (
                <span className="text-neutral-400">Not set — add it in Edit</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Scan now</h2>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          Fetches the pricing, changelog, careers, and review pages above and saves
          a snapshot of each. Pages that have not changed since the last scan are
          not stored again.
        </p>
        {scanError && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{scanError}</p>}
        {scanResult && (
          <ul className="mt-3 space-y-1 text-sm">
            {scanResult.results.map((r) => (
              <li key={r.sourceType} className="flex gap-2">
                <span className="font-medium">{sourceLabel(r.sourceType)}:</span>
                <span>{outcomeLabel(r.outcome)}{r.message ? ` — ${r.message}` : ""}{r.outcome === "created" && r.changesDetected !== undefined && r.changesDetected > 0 ? ` — ${r.changesDetected} change${r.changesDetected === 1 ? "" : "s"} detected` : ""}</span>
              </li>
            ))}
            {scanResult.results.length === 0 && (
              <li className="text-neutral-600">No pages configured to scan yet — add a pricing, changelog, careers, or review URL in Edit.</li>
            )}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Detected changes</h2>
        {changes.length === 0 ? (
          <p className="mt-2 rounded-lg border border-neutral-200 bg-white p-5 text-neutral-700">
            No changes detected yet. The first scan sets the baseline; the next
            scan compares against it and lists what moved here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {changes.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Snapshot history</h2>
        {snapshots.length === 0 ? (
          <p className="mt-2 rounded-lg border border-neutral-200 bg-white p-5 text-neutral-700">
            No snapshots yet. Press <strong>Scan now</strong> to take the first snapshot of each page.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {snapshots.map((s) => (
              <li key={s.id} className="rounded-lg border border-neutral-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {sourceLabel(s.sourceType)}{" "}
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === "success" ? "bg-green-100 text-green-800" :
                        s.status === "blocked" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>
                        {s.status}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">{snapshotSummary(s)}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {new Date(s.scrapedAt).toLocaleString()}
                      {s.contentHash ? ` · #${s.contentHash.slice(0, 8)}` : ""}
                    </p>
                    {s.textPreview && (
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{s.textPreview}</p>
                    )}
                  </div>
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer"
                    className="shrink-0 text-sm text-indigo-700 hover:underline">
                    Source ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
