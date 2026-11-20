"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  ScanLine,
  Sparkles,
  Swords,
} from "lucide-react";
import { getCompetitor } from "@/services/competitors";
import { listSnapshots, triggerScan } from "@/services/scans";
import { getScanJob, listCompetitorScanJobs } from "@/services/jobs";
import { listCompetitorChanges } from "@/services/changes";
import { analyzeCompetitor, listAnalyses } from "@/services/analysis";
import ChangeCard, { categoryLabel } from "@/components/ChangeCard";
import { Badge, Card, EmptyState, BackLink, PageHeader, btnPrimary, btnSecondary } from "@/components/ui";
import type { Analysis, ChangeEvent, Competitor, ScanJob, ScanSummary, Snapshot } from "@/types";

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

// One labelled bullet list inside an analysis (implications, strengths…).
// Empty sections are hidden — the model may legitimately have nothing to
// say in a section when the changes are minor.
function analysisList(title: string, items: string[]) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
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
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummary | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanJobStatus, setScanJobStatus] = useState("");
  const [scanJobs, setScanJobs] = useState<ScanJob[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeMessage, setAnalyzeMessage] = useState("");

  const loadSnapshots = useCallback(async () => {
    setSnapshots(await listSnapshots(id));
  }, [id]);

  const loadChanges = useCallback(async () => {
    setChanges(await listCompetitorChanges(id, { limit: 20 }));
  }, [id]);

  const loadAnalyses = useCallback(async () => {
    const list = await listAnalyses(id);
    setAnalyses(list);
    setSelectedAnalysisId((current) => current ?? (list.length > 0 ? list[0].id : null));
  }, [id]);

  const loadScanJobs = useCallback(async () => {
    setScanJobs(await listCompetitorScanJobs(id, 10));
  }, [id]);

  useEffect(() => {
    getCompetitor(id)
      .then((c) => {
        setCompetitor(c);
        return Promise.all([loadSnapshots(), loadChanges(), loadAnalyses(), loadScanJobs()]);
      })
      .catch((err) => {
        if (err instanceof Error && /not signed in/i.test(err.message)) {
          router.push("/login");
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Could not load competitor");
      });
  }, [id, router, loadSnapshots, loadChanges, loadAnalyses, loadScanJobs]);

  async function handleScan() {
    setScanning(true);
    setScanError("");
    setScanResult(null);
    setScanJobStatus("");
    try {
      const result = await triggerScan(id);
      // Redis down: the scan already ran synchronously in the request.
      if (!result.queued && result.scan) {
        setScanResult(result.scan);
        setScanJobStatus("Completed synchronously (Redis was down)");
        await Promise.all([loadSnapshots(), loadChanges(), loadScanJobs()]);
        return;
      }
      // Queued: poll the job until it completes, fails, or times out.
      const jobKey = result.scanJobId || result.jobId;
      if (!jobKey) throw new Error("Scan was queued but no job id was returned");
      setScanJobStatus("Queued — waiting for the worker…");
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const job = await getScanJob(jobKey);
        setScanJobStatus(
          job.status === "active"
            ? "Scanning…"
            : job.status === "completed"
              ? "Completed"
              : job.status === "failed"
                ? `Failed: ${job.errorMessage || "scan failed"}`
                : "Queued — waiting for the worker…"
        );
        if (job.status === "completed") {
          if (job.resultSummary) {
            setScanResult({ competitorId: id, scannedAt: job.resultSummary.scannedAt, results: job.resultSummary.results as ScanSummary["results"] });
          }
          await Promise.all([loadSnapshots(), loadChanges(), loadScanJobs()]);
          return;
        }
        if (job.status === "failed") {
          setScanError(job.errorMessage || "Scan failed");
          await loadScanJobs();
          return;
        }
      }
      setScanJobStatus("Still running after 2 minutes — check the scan jobs list below.");
      await loadScanJobs();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalyzeMessage("");
    try {
      const result = await analyzeCompetitor(id);
      if (result.analysis) {
        setAnalyses((current) => [result.analysis!, ...current]);
        setSelectedAnalysisId(result.analysis!.id);
      } else {
        setAnalyzeMessage(result.message || "No new changes to analyse.");
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedAnalysis = analyses.find((a) => a.id === selectedAnalysisId) ?? null;

  if (loadError) {
    return (
      <div>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
        <BackLink href="/competitors">
          <ArrowLeft className="h-4 w-4" /> Back to competitors
        </BackLink>
      </div>
    );
  }
  if (!competitor) {
    return (
      <p className="flex items-center gap-2 py-16 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading competitor…
      </p>
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
    <div>
      <PageHeader
        eyebrow={
          <BackLink href="/competitors">
            <ArrowLeft className="h-4 w-4" /> Competitors
          </BackLink>
        }
        title={competitor.companyName}
        description={`${competitor.websiteUrl} · Checks ${competitor.monitoringFrequency} · Added ${new Date(competitor.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <Link href={`/battlecards/${competitor.id}`} className={btnSecondary}>
              <Swords className="h-4 w-4" /> Battlecard
            </Link>
            <Link href={`/competitors/${competitor.id}/edit`} className={btnSecondary}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </>
        }
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {competitor.isMonitoringEnabled ? (
          <Badge tone="green">Monitoring</Badge>
        ) : (
          <Badge tone="neutral">Paused</Badge>
        )}
        {competitor.lastScannedAt ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            Last scanned {new Date(competitor.lastScannedAt).toLocaleString()}
            {competitor.lastScanStatus ? ` (${competitor.lastScanStatus})` : ""}
          </span>
        ) : (
          <span className="text-sm text-slate-500">Never scanned yet</span>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Globe className="h-5 w-5 text-indigo-600" /> Pages being watched
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {urls.map(({ label, url }) => (
                <li key={label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-28 shrink-0 text-sm font-medium text-slate-700">{label}</span>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-sm text-indigo-600 hover:underline">
                      <span className="truncate">{url}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">Not set — add it in Edit</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ScanLine className="h-5 w-5 text-indigo-600" /> Scan now
              </h2>
              <button onClick={handleScan} disabled={scanning} className={btnPrimary}>
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" /> Scan now
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Fetches the pricing, changelog, careers, and review pages above and saves
              a snapshot of each. Pages that have not changed since the last scan are
              not stored again. The scan runs as a background job — this page polls
              its status and reloads when it finishes.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Scheduled scans: {competitor.isMonitoringEnabled ? `on, every ${competitor.monitoringFrequency}` : "paused — automatic scans are off, manual scans still work"}
            </p>
            {scanJobStatus && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
                <Loader2 className="h-4 w-4 animate-spin" /> {scanJobStatus}
              </p>
            )}
            {scanError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{scanError}</p>}
            {scanResult && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {scanResult.results.map((r) => (
                  <li key={r.sourceType} className="flex gap-2">
                    <span className="font-medium text-slate-900">{sourceLabel(r.sourceType)}:</span>
                    <span className="text-slate-700">{outcomeLabel(r.outcome)}{r.message ? ` — ${r.message}` : ""}{r.outcome === "created" && r.changesDetected !== undefined && r.changesDetected > 0 ? ` — ${r.changesDetected} change${r.changesDetected === 1 ? "" : "s"} detected` : ""}</span>
                  </li>
                ))}
                {scanResult.results.length === 0 && (
                  <li className="text-slate-600">No pages configured to scan yet — add a pricing, changelog, careers, or review URL in Edit.</li>
                )}
              </ul>
            )}
          </Card>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Detected changes</h2>
            {changes.length === 0 ? (
              <Card className="mt-3">
                <EmptyState
                  title="No changes detected yet"
                  description="The first scan sets the baseline; the next scan compares against it and lists what moved here."
                />
              </Card>
            ) : (
              <ul className="mt-3 space-y-3">
                {changes.map((c) => (
                  <ChangeCard key={c.id} change={c} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <History className="h-5 w-5 text-indigo-600" /> Recent scan jobs
            </h2>
            {scanJobs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No scan jobs yet. Press “Scan now” above, or wait for a scheduled scan.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {scanJobs.map((j) => (
                  <li key={j.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-900">{j.trigger === "scheduled" ? "Scheduled" : "Manual"}</span>
                      <Badge
                        tone={
                          j.status === "completed"
                            ? "green"
                            : j.status === "failed"
                              ? "red"
                              : j.status === "active"
                                ? "indigo"
                                : "neutral"
                        }
                      >
                        {j.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {j.queuedAt ? new Date(j.queuedAt).toLocaleString() : ""}
                      {j.errorMessage ? ` — ${j.errorMessage}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-indigo-600" /> AI analysis
              </h2>
              <button onClick={handleAnalyze} disabled={analyzing} className={btnPrimary}>
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                  </>
                ) : (
                  "Analyse latest changes"
                )}
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Sends the newest detected changes that no earlier analysis has
              covered to OpenAI and returns a structured summary — what changed,
              what it could mean, strengths, weaknesses, and what to say to
              customers. Each run uses API credits, so it only runs when you
              press the button.
            </p>
            {analyzeError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{analyzeError}</p>}
            {analyzeMessage && <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">{analyzeMessage}</p>}
            {selectedAnalysis ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    tone={
                      selectedAnalysis.confidence === "high"
                        ? "green"
                        : selectedAnalysis.confidence === "medium"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    Confidence: {selectedAnalysis.confidence}
                  </Badge>
                  <span className="text-slate-500">
                    {new Date(selectedAnalysis.generatedAt).toLocaleString()} · {selectedAnalysis.aiModel}
                  </span>
                </p>
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  AI-generated — verify before using in sales conversations. The
                  detected changes it is based on are listed under “Based on”
                  below.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{selectedAnalysis.summary}</p>
                {analysisList("What this could mean", selectedAnalysis.implications)}
                {analysisList("Strengths", selectedAnalysis.strengths)}
                {analysisList("Weaknesses", selectedAnalysis.weaknesses)}
                {analysisList("Suggested responses", selectedAnalysis.suggestedResponses)}
                {analysisList("Talking points", selectedAnalysis.talkingPoints)}
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Based on</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    {selectedAnalysis.sources.map((s, i) => (
                      <li key={i}>
                        {categoryLabel(s.category)}: {s.title}{" "}
                        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                          Source ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                {analyses.length > 1 && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900">Previous analyses</h3>
                    <ul className="mt-2 space-y-1.5">
                      {analyses.map((a) => (
                        <li key={a.id}>
                          <button
                            onClick={() => setSelectedAnalysisId(a.id)}
                            className={`text-left text-sm hover:underline ${a.id === selectedAnalysisId ? "font-medium text-indigo-600" : "text-slate-600"}`}
                          >
                            {new Date(a.generatedAt).toLocaleString()} — {a.summary.slice(0, 80)}
                            {a.summary.length > 80 ? "…" : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No analysis yet. Detect some changes first (scan, change a page,
                scan again), then press “Analyse latest changes”.
              </p>
            )}
          </Card>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-indigo-600" /> Snapshot history
        </h2>
        {snapshots.length === 0 ? (
          <Card className="mt-3">
            <EmptyState
              title="No snapshots yet"
              description="Press Scan now to take the first snapshot of each page."
            />
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {snapshots.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      {sourceLabel(s.sourceType)}{" "}
                      <Badge
                        tone={s.status === "success" ? "green" : s.status === "blocked" ? "amber" : "red"}
                      >
                        {s.status}
                      </Badge>
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{snapshotSummary(s)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(s.scrapedAt).toLocaleString()}
                      {s.contentHash ? ` · #${s.contentHash.slice(0, 8)}` : ""}
                    </p>
                    {s.textPreview && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{s.textPreview}</p>
                    )}
                  </div>
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
                    Source <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
