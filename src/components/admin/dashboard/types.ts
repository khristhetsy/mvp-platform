import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";
import type { OperationalActivityFeedItem } from "@/lib/operational-activity/types";
import type { OrchestrationSummary } from "@/lib/notifications/orchestration/types";
import type { OrchestrationExecutionSummary } from "@/lib/notifications/orchestration/execution-log";
import type { ScheduledOperationalCounts } from "@/lib/notifications/scheduled/types";

export type AutomationDailySummary = {
  automationsTriggeredToday: number;
  blockedWorkflows: number;
  dependenciesResolvedToday: number;
  automationFailuresToday: number;
  staleChains: number;
};
import type { AdminQueueSummaryItem } from "@/lib/queues/admin-queues";
import type { InternalPermission } from "@/lib/rbac/constants";

export type AdminDashboardMetrics = {
  founders: number;
  companies: number;
  pendingReviews: number;
  documents: number;
  pitchDecks: number;
  publishedDeals: number;
};

export type AdminCommandCenterSnapshot = {
  totalInvestors: number;
  pendingInvestorApprovals: number;
  openComplianceEvents: number;
  pendingUpgradeRequests: number;
  spvPipelineCount: number;
  notificationCount: number;
  reportsGenerated: number;
};

export type AdminInvestorActivityData = {
  interests: Array<Record<string, unknown>>;
  introRequests: Array<Record<string, unknown>>;
  savedDeals: Array<Record<string, unknown>>;
};

export type AdminCommandCenterProps = {
  /** Viewer's effective RBAC permissions; gates which cards render. */
  permissions: InternalPermission[];
  userId: string;
  userRole: string;
  serviceRoleConfigured: boolean;
  loadedAt: string;
  metrics: AdminDashboardMetrics;
  snapshot: AdminCommandCenterSnapshot;
  pendingCount: number;
  companyCards: AdminCompanyCardData[];
  investorActivity: AdminInvestorActivityData;
  crmActivity: AdminCrmActivityRow[];
  operationalActivity: OperationalActivityFeedItem[];
  queueSummary: AdminQueueSummaryItem[];
  orchestrationCounts?: OrchestrationSummary;
  scheduledCounts?: ScheduledOperationalCounts;
  executionSummary?: OrchestrationExecutionSummary;
  automationSummary?: AutomationDailySummary;
};
