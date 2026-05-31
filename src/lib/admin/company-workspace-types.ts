import type { AdminCompanyCardPayload } from "@/lib/data/admin";
import type { ComplianceEventRecord } from "@/lib/compliance/types";
import type { OperationalActivityFeedItem } from "@/lib/operational-activity/types";
import type { AdminQueueItem } from "@/lib/queues/admin-queues";
import type { summarizeRemediationTasks } from "@/lib/remediation/tasks";

export type AdminCompanyWorkspaceSpvSummary = {
  id: string;
  name: string;
  status: string;
  operationalReadiness: string;
  operationalReadinessLabel: string;
  checklistPct: number;
  packagePct: number;
  closingPct: number;
  indicativeTotal: string;
  participantCount: number;
  pendingRequirements: number;
  nextAction: string;
};

export type AdminCompanyWorkspaceData = {
  company: AdminCompanyCardPayload;
  founder: { id: string; full_name: string | null; email: string | null } | null;
  readiness: {
    latestScore: number | null;
    scoreHistory: Array<{ readiness_score: number | null; created_at: string }>;
    onboardingPercent: number;
    onboardingCompletedAt: string | null;
    remediation: ReturnType<typeof summarizeRemediationTasks> & { highPriorityOpen: number };
    nextAction: string;
    milestoneLabel: string;
  };
  investorActivity: {
    savedDeals: number;
    interests: number;
    introRequests: number;
    messageThreads: number;
    meetingsScheduled: number;
    pledgeTotal: number;
    interestAmountTotal: number;
  };
  spvs: AdminCompanyWorkspaceSpvSummary[];
  compliance: {
    openCount: number;
    criticalCount: number;
    highCount: number;
    recentEvents: ComplianceEventRecord[];
    nextAction: string | null;
  };
  documents: {
    totalCount: number;
    pitchDeckPresent: boolean;
    latestDiligenceReport: {
      id: string;
      readiness_score: number | null;
      created_at: string;
      missing_documents: unknown;
    } | null;
    missingRequiredHints: string[];
  };
  timeline: OperationalActivityFeedItem[];
  queueItems: AdminQueueItem[];
};

export function getAdminCompanyWorkspaceHref(companyId: string): string {
  return `/admin/companies/${companyId}`;
}

export function buildCompanyReportHref(companyId: string, reportType: string): string {
  const params = new URLSearchParams({ companyId, reportType });
  return `/admin/reports?${params.toString()}`;
}

export function buildCompanyFilteredHref(
  base: string,
  companyId: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ company: companyId, ...extra });
  return `${base}?${params.toString()}`;
}
