export type BackendHealth = {
  status: string;
  service: string;
  timestamp: string;
  database: "connected" | "disconnected";
  databaseNote: string;
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
