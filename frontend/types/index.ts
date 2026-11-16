export type BackendHealth = {
  status: string;
  service: string;
  timestamp: string;
  database: "connected" | "disconnected";
  databaseNote: string;
  redis?: "connected" | "disconnected";
  redisNote?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: { id: string; name: string };
};

export type MonitoringFrequency = "hourly" | "daily" | "weekly";

export type Competitor = {
  id: string;
  organizationId: string;
  companyName: string;
  websiteUrl: string;
  pricingPageUrl?: string;
  changelogUrl?: string;
  careersPageUrl?: string;
  reviewSourceUrl?: string;
  monitoringFrequency: MonitoringFrequency;
  isMonitoringEnabled: boolean;
  lastScannedAt?: string | null;
  lastScanStatus?: "success" | "partial" | "failed" | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorInput = {
  companyName: string;
  websiteUrl: string;
  pricingPageUrl?: string;
  changelogUrl?: string;
  careersPageUrl?: string;
  reviewSourceUrl?: string;
  monitoringFrequency: MonitoringFrequency;
  isMonitoringEnabled: boolean;
};

export type SnapshotSourceType = "pricing" | "changelog" | "careers" | "reviews";
export type SnapshotStatus = "success" | "failed" | "blocked";

export type Snapshot = {
  id: string;
  organizationId: string;
  competitorId: string;
  sourceType: SnapshotSourceType;
  sourceUrl: string;
  status: SnapshotStatus;
  contentHash?: string;
  extractedData?: Record<string, unknown>;
  textPreview?: string;
  errorMessage?: string;
  scrapedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScanSourceResult = {
  sourceType: SnapshotSourceType;
  sourceUrl: string;
  outcome: "created" | "unchanged" | "failed" | "blocked";
  snapshotId?: string;
  contentHash?: string;
  // Phase 5: how many meaningful changes this scan detected vs the
  // previous snapshot (0 on a first scan — the baseline).
  changesDetected?: number;
  message?: string;
};

export type ScanSummary = {
  competitorId: string;
  scannedAt: string;
  results: ScanSourceResult[];
};

export type ChangeCategory =
  | "price_increase"
  | "price_decrease"
  | "plan_added"
  | "plan_removed"
  | "entry_added"
  | "entry_removed"
  | "job_posted"
  | "job_removed"
  | "review_added"
  | "negative_review";

export type ChangeSignificance = "high" | "medium" | "low";

export type ChangeEvent = {
  id: string;
  organizationId: string;
  competitorId: string;
  competitorName?: string;
  sourceType: SnapshotSourceType;
  category: ChangeCategory;
  significance: ChangeSignificance;
  title: string;
  previousValue?: unknown;
  newValue?: unknown;
  sourceUrl: string;
  snapshotId: string;
  previousSnapshotId: string;
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisConfidence = "high" | "medium" | "low";

export type AnalysisSource = {
  category: ChangeCategory;
  title: string;
  sourceUrl: string;
};

// Phase 6: one OpenAI analysis of a set of detected changes. Everything
// except `sources` is AI-generated — the UI labels it as such.
export type Analysis = {
  id: string;
  organizationId: string;
  competitorId: string;
  changeIds: string[];
  sources: AnalysisSource[];
  summary: string;
  implications: string[];
  strengths: string[];
  weaknesses: string[];
  suggestedResponses: string[];
  talkingPoints: string[];
  confidence: AnalysisConfidence;
  aiModel: string;
  promptTokens?: number;
  completionTokens?: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
};

// Phase 7: a sales battlecard for one competitor. Pricing, features,
// recent changes, complaints, and sources are verified data from scans;
// strengths, weaknesses, talking points, and objection handling come
// from the latest AI analysis (aiSections names them).
export type BattlecardPlan = {
  name: string;
  price: number | null;
  currency: string | null;
  interval: string;
  raw: string;
};

export type BattlecardFeature = { title: string; date: string | null };

export type BattlecardRecentChange = {
  category: ChangeCategory;
  title: string;
  significance: ChangeSignificance;
  detectedAt: string;
  sourceUrl: string;
};

export type BattlecardComplaint = { text: string; rating: number | null };

export type BattlecardSource = { label: string; url: string };

export type Battlecard = {
  id: string;
  organizationId: string;
  competitorId: string;
  competitorName?: string;
  version: number;
  generatedFromAnalysisId: string | null;
  overview: string;
  positioning: string;
  pricing: BattlecardPlan[];
  pricingSourceUrl?: string;
  pricingSnapshotDate?: string;
  features: BattlecardFeature[];
  strengths: string[];
  weaknesses: string[];
  recentChanges: BattlecardRecentChange[];
  complaints: BattlecardComplaint[];
  talkingPoints: string[];
  objectionHandling: string[];
  sources: BattlecardSource[];
  aiSections: string[];
  createdAt: string;
  updatedAt: string;
};

export type BattlecardListItem = {
  competitorId: string;
  competitorName?: string;
  websiteUrl?: string;
  version: number;
  updatedAt: string;
};

export type BattlecardVersionInfo = { version: number; createdAt: string };

export type BattlecardVersionDetail = {
  version: number;
  createdAt: string;
  content: Record<string, unknown>;
};

// Phase 8: the dashboard overview — every number is a real count or
// aggregation over the signed-in user's own organization. No sample data.
export type DashboardStats = {
  competitors: number;
  monitoringEnabled: number;
  monitoringPaused: number;
  snapshots: number;
  changes: number;
  changesLast7Days: number;
  highChangesLast7Days: number;
  battlecards: number;
  analyses: number;
};

export type DashboardDayCount = { date: string; count: number };

export type DashboardTopCompetitor = {
  competitorId: string;
  competitorName?: string;
  changeCount: number;
  latestChangeAt: string;
};

export type DashboardChangeItem = {
  id: string;
  competitorId: string;
  competitorName?: string;
  category: ChangeCategory;
  title: string;
  significance: ChangeSignificance;
  detectedAt: string;
  sourceUrl: string;
};

export type DashboardScanHealth = {
  competitorId: string;
  competitorName: string;
  monitoringEnabled: boolean;
  lastScanAt: string | null;
  lastScanStatus: string | null;
  totalSnapshots: number;
};

export type DashboardOverview = {
  stats: DashboardStats;
  changesPerDay: DashboardDayCount[];
  topCompetitors: DashboardTopCompetitor[];
  priceMoves: DashboardChangeItem[];
  recentChanges: DashboardChangeItem[];
  scanHealth: DashboardScanHealth[];
};

// Phase 9: background scan jobs (BullMQ + ScanJob record).
export type ScanJobTrigger = "manual" | "scheduled";
export type ScanJobStatus = "queued" | "active" | "completed" | "failed";

export type ScanJob = {
  id: string;
  organizationId: string;
  competitorId: string;
  jobId: string;
  trigger: ScanJobTrigger;
  status: ScanJobStatus;
  resultSummary?: {
    scannedAt: string;
    results: { sourceType: string; outcome: string; changesDetected?: number; message?: string }[];
  } | null;
  errorMessage?: string | null;
  attemptsMade?: number | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScanEnqueueResult = {
  queued: boolean;
  jobId?: string;
  scanJobId?: string | null;
  status?: ScanJobStatus;
  message?: string;
  scan?: ScanSummary;
};
