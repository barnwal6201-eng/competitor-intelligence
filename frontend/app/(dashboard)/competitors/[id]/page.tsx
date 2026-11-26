"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import Grid from "@mui/material/Grid2";
import HistoryIcon from "@mui/icons-material/History";
import LanguageIcon from "@mui/icons-material/Language";
import LinkMui from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import RadarIcon from "@mui/icons-material/Radar";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StyleIcon from "@mui/icons-material/Style";
import Typography from "@mui/material/Typography";
import { getCompetitor } from "@/services/competitors";
import { listSnapshots, triggerScan } from "@/services/scans";
import { getScanJob, listCompetitorScanJobs } from "@/services/jobs";
import { listCompetitorChanges } from "@/services/changes";
import { analyzeCompetitor, listAnalyses } from "@/services/analysis";
import ChangeCard, { categoryLabel } from "@/components/ChangeCard";
import { Badge, EmptyState, BackLink, PageHeader } from "@/components/ui";
import { motion } from "framer-motion";
import { fadeUp, staggerParent } from "@/components/motion";
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
    <Box sx={{ mt: 2.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, "& li": { mb: 0.75, lineHeight: 1.6 } }}>
        {items.map((item, i) => (
          <Typography key={i} component="li" variant="body2">{item}</Typography>
        ))}
      </Box>
    </Box>
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
      <Box>
        <Alert severity="error">{loadError}</Alert>
        <Box sx={{ mt: 2 }}>
          <BackLink href="/competitors">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to competitors
          </BackLink>
        </Box>
      </Box>
    );
  }
  if (!competitor) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 8, color: "text.secondary" }}>
        <CircularProgress size={18} /> Loading competitor…
      </Box>
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
    <Box>
      <PageHeader
        eyebrow={
          <BackLink href="/competitors">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Competitors
          </BackLink>
        }
        title={competitor.companyName}
        description={`${competitor.websiteUrl} · Checks ${competitor.monitoringFrequency} · Added ${new Date(competitor.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <Button variant="outlined" component={Link} href={`/battlecards/${competitor.id}`} startIcon={<StyleIcon />}>
              Battlecard
            </Button>
            <Button variant="outlined" component={Link} href={`/competitors/${competitor.id}/edit`} startIcon={<EditIcon />}>
              Edit
            </Button>
          </>
        }
      />
      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        {competitor.isMonitoringEnabled ? (
          <Badge tone="green">Monitoring</Badge>
        ) : (
          <Badge tone="neutral">Paused</Badge>
        )}
        {competitor.lastScannedAt ? (
          <Typography variant="body2" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
            <ScheduleIcon sx={{ fontSize: 16 }} />
            Last scanned {new Date(competitor.lastScannedAt).toLocaleString()}
            {competitor.lastScanStatus ? ` (${competitor.lastScanStatus})` : ""}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">Never scanned yet</Typography>
        )}
      </Box>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, xl: 7 }} component={motion.div} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Card>
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LanguageIcon color="primary" /> Pages being watched
                </Typography>
                <Box component="ul" sx={{ m: 0, mt: 2, p: 0, listStyle: "none" }}>
                  {urls.map(({ label, url }) => (
                    <Box
                      key={label}
                      component="li"
                      sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: "1px solid rgba(17,24,39,0.06)", "&:last-child": { borderBottom: "none", pb: 0 }, "&:first-of-type": { pt: 0 } }}
                    >
                      <Typography variant="body2" sx={{ width: 112, flexShrink: 0, fontWeight: 600 }}>{label}</Typography>
                      {url ? (
                        <LinkMui href={url} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", minWidth: 0, alignItems: "center", gap: 0.5, fontSize: "0.875rem" }}>
                          <Typography component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</Typography>
                          <OpenInNewIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                        </LinkMui>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Not set — add it in Edit</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Card>

            <Card>
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                  <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <RadarIcon color="primary" /> Scan now
                  </Typography>
                  <Button onClick={handleScan} disabled={scanning} variant="contained" startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}>
                    {scanning ? "Scanning…" : "Scan now"}
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
                  Fetches the pricing, changelog, careers, and review pages above and saves
                  a snapshot of each. Pages that have not changed since the last scan are
                  not stored again. The scan runs as a background job — this page polls
                  its status and reloads when it finishes.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Scheduled scans: {competitor.isMonitoringEnabled ? `on, every ${competitor.monitoringFrequency}` : "paused — automatic scans are off, manual scans still work"}
                </Typography>
                {scanJobStatus && (
                  <Alert severity="info" icon={<CircularProgress size={16} />} sx={{ mt: 2 }}>
                    {scanJobStatus}
                  </Alert>
                )}
                {scanError && (
                  <Alert severity="error" sx={{ mt: 2 }}>{scanError}</Alert>
                )}
                {scanResult && (
                  <Box component="ul" sx={{ m: 0, mt: 2, p: 0, listStyle: "none", "& li": { mb: 0.75 } }}>
                    {scanResult.results.map((r) => (
                      <Typography key={r.sourceType} component="li" variant="body2">
                        <Typography component="span" sx={{ fontWeight: 700 }}>{sourceLabel(r.sourceType)}:</Typography>{" "}
                        {outcomeLabel(r.outcome)}{r.message ? ` — ${r.message}` : ""}{r.outcome === "created" && r.changesDetected !== undefined && r.changesDetected > 0 ? ` — ${r.changesDetected} change${r.changesDetected === 1 ? "" : "s"} detected` : ""}
                      </Typography>
                    ))}
                    {scanResult.results.length === 0 && (
                      <Typography component="li" variant="body2" color="text.secondary">
                        No pages configured to scan yet — add a pricing, changelog, careers, or review URL in Edit.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Card>

            <Box>
              <Typography variant="h6">Detected changes</Typography>
              {changes.length === 0 ? (
                <Card sx={{ mt: 1.5 }}>
                  <EmptyState
                    title="No changes detected yet"
                    description="The first scan sets the baseline; the next scan compares against it and lists what moved here."
                  />
                </Card>
              ) : (
                <motion.ul variants={staggerParent} initial="hidden" animate="show" style={{ margin: 0, marginTop: 12, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {changes.map((c) => (
                    <ChangeCard key={c.id} change={c} />
                  ))}
                </motion.ul>
              )}
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }} component={motion.div} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Card>
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <HistoryIcon color="primary" /> Recent scan jobs
                </Typography>
                {scanJobs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    No scan jobs yet. Press “Scan now” above, or wait for a scheduled scan.
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, mt: 2, p: 0, listStyle: "none" }}>
                    {scanJobs.map((j) => (
                      <Box
                        key={j.id}
                        component="li"
                        sx={{ py: 1.5, borderBottom: "1px solid rgba(17,24,39,0.06)", "&:last-child": { borderBottom: "none", pb: 0 }, "&:first-of-type": { pt: 0 } }}
                      >
                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {j.trigger === "scheduled" ? "Scheduled" : "Manual"}
                          </Typography>
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
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          {j.queuedAt ? new Date(j.queuedAt).toLocaleString() : ""}
                          {j.errorMessage ? ` — ${j.errorMessage}` : ""}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Card>

            <Card>
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                  <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AutoAwesomeIcon color="primary" /> AI analysis
                  </Typography>
                  <Button onClick={handleAnalyze} disabled={analyzing} variant="contained" startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : undefined}>
                    {analyzing ? "Analysing…" : "Analyse latest changes"}
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
                  Sends the newest detected changes that no earlier analysis has
                  covered to OpenAI and returns a structured summary — what changed,
                  what it could mean, strengths, weaknesses, and what to say to
                  customers. Each run uses API credits, so it only runs when you
                  press the button.
                </Typography>
                {analyzeError && (
                  <Alert severity="error" sx={{ mt: 2 }}>{analyzeError}</Alert>
                )}
                {analyzeMessage && (
                  <Alert severity="info" sx={{ mt: 2 }}>{analyzeMessage}</Alert>
                )}
                {selectedAnalysis ? (
                  <Box sx={{ mt: 2, borderTop: "1px solid rgba(17,24,39,0.06)", pt: 2 }}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
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
                      <Typography variant="body2" color="text.secondary">
                        {new Date(selectedAnalysis.generatedAt).toLocaleString()} · {selectedAnalysis.aiModel}
                      </Typography>
                    </Box>
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      AI-generated — verify before using in sales conversations. The
                      detected changes it is based on are listed under “Based on”
                      below.
                    </Alert>
                    <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.7 }}>{selectedAnalysis.summary}</Typography>
                    {analysisList("What this could mean", selectedAnalysis.implications)}
                    {analysisList("Strengths", selectedAnalysis.strengths)}
                    {analysisList("Weaknesses", selectedAnalysis.weaknesses)}
                    {analysisList("Suggested responses", selectedAnalysis.suggestedResponses)}
                    {analysisList("Talking points", selectedAnalysis.talkingPoints)}
                    <Box sx={{ mt: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Based on</Typography>
                      <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: "none", "& li": { mb: 0.75 } }}>
                        {selectedAnalysis.sources.map((s, i) => (
                          <Typography key={i} component="li" variant="body2" color="text.secondary">
                            {categoryLabel(s.category)}: {s.title}{" "}
                            <LinkMui href={s.sourceUrl} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
                              Source ↗
                            </LinkMui>
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                    {analyses.length > 1 && (
                      <Box sx={{ mt: 2.5, borderTop: "1px solid rgba(17,24,39,0.06)", pt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Previous analyses</Typography>
                        <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: "none", "& li": { mb: 0.75 } }}>
                          {analyses.map((a) => (
                            <Box key={a.id} component="li">
                              <LinkMui
                                component="button"
                                onClick={() => setSelectedAnalysisId(a.id)}
                                sx={{
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                  color: a.id === selectedAnalysisId ? "primary.main" : "text.secondary",
                                  fontWeight: a.id === selectedAnalysisId ? 600 : 400,
                                  "&:hover": { textDecoration: "underline" },
                                }}
                              >
                                {new Date(a.generatedAt).toLocaleString()} — {a.summary.slice(0, 80)}
                                {a.summary.length > 80 ? "…" : ""}
                              </LinkMui>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    No analysis yet. Detect some changes first (scan, change a page,
                    scan again), then press “Analyse latest changes”.
                  </Typography>
                )}
              </Box>
            </Card>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DescriptionIcon color="primary" /> Snapshot history
        </Typography>
        {snapshots.length === 0 ? (
          <Card sx={{ mt: 1.5 }}>
            <EmptyState
              title="No snapshots yet"
              description="Press Scan now to take the first snapshot of each page."
            />
          </Card>
        ) : (
          <motion.ul variants={staggerParent} initial="hidden" animate="show" style={{ margin: 0, marginTop: 12, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {snapshots.map((s) => (
              <Card key={s.id} component={motion.li} variants={fadeUp} sx={{ listStyle: "none" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, p: 2.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{sourceLabel(s.sourceType)}</Typography>
                      <Badge tone={s.status === "success" ? "green" : s.status === "blocked" ? "amber" : "red"}>
                        {s.status}
                      </Badge>
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{snapshotSummary(s)}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {new Date(s.scrapedAt).toLocaleString()}
                      {s.contentHash ? ` · #${s.contentHash.slice(0, 8)}` : ""}
                    </Typography>
                    {s.textPreview && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {s.textPreview}
                      </Typography>
                    )}
                  </Box>
                  <LinkMui href={s.sourceUrl} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", flexShrink: 0, alignItems: "center", gap: 0.5, fontSize: "0.875rem", fontWeight: 600 }}>
                    Source <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </LinkMui>
                </Box>
              </Card>
            ))}
          </motion.ul>
        )}
      </Box>
    </Box>
  );
}
