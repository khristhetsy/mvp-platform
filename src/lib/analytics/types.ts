export const TREND_WINDOWS_DAYS = [7, 30, 90] as const;
export type TrendWindowDays = (typeof TREND_WINDOWS_DAYS)[number];

export type TrendPoint = {
  /** YYYY-MM-DD in UTC */
  day: string;
  value: number;
};

export type TrendSeries = {
  key: string;
  label: string;
  points: TrendPoint[];
  total: number;
};

export type PlatformCoreMetrics = {
  totalCompanies: number;
  activeCompanies: number;
  publishedCompanies: number;
  pendingCompanyReviews: number;
  totalInvestors: number;
  approvedInvestors: number;
  expressedInterests: number;
  introRequests: number;
  savedDeals: number;
  totalIndicativeAmount: number;
  activeSpvs: number;
  spvChecklistReadinessAvg: number;
  spvPackageReadinessAvg: number;
  spvClosingReadinessAvg: number;
  overdueActions: number;
  completedActions: number;
  automationRunsSucceeded: number;
  automationRunsFailedOrPartial: number;
  complianceOpen: number;
  complianceCriticalOpen: number;
  complianceResolvedWindow: number;
  importsProcessedWindow: number;
  importsFailedWindow: number;
  exportsGeneratedWindow: number;
  collaborationCommentsWindow: number;
};

export type BottleneckItem = {
  key: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  count: number;
  href: string;
  description: string;
};

export type BottleneckEntityRow = {
  entityType: "company" | "spv" | "compliance_event" | "action" | "import_batch" | "automation_run";
  entityId: string;
  label: string;
  ageDays: number;
  href: string;
  reason: string;
};

export type PlatformAnalyticsSnapshot = {
  windowDays: TrendWindowDays;
  generatedAt: string;
  metrics: PlatformCoreMetrics;
  trends: {
    platformActivity: TrendSeries[];
    investorEngagement: TrendSeries[];
    compliance: TrendSeries[];
    importsExports: TrendSeries[];
    collaboration: TrendSeries[];
    automation: TrendSeries[];
  };
  bottlenecks: {
    cards: BottleneckItem[];
    entities: BottleneckEntityRow[];
  };
  health: {
    score: "healthy" | "degraded" | "unhealthy";
    reasons: string[];
  };
};

