import type { ComplianceEventRecord } from "@/lib/compliance/types";
import type { OperationalActivityFeedItem } from "@/lib/operational-activity/types";
import type { AdminQueueItem } from "@/lib/queues/admin-queues";
import type { ClosingReadinessSummary } from "@/lib/spv/closing-review-display";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";

export type AdminSpvWorkspaceCompany = {
  id: string;
  name: string;
  slug: string | null;
};

export type AdminSpvWorkspaceParticipationRow = {
  id: string;
  investorId: string;
  investorName: string;
  status: string;
  indicativeAmount: string;
  documentReadinessPct: number;
  pendingRequirements: number;
};

export type AdminSpvWorkspaceRequirementUpdate = {
  id: string;
  title: string;
  status: string;
  investorName: string;
  category: string;
  updatedAt: string;
};

export type AdminSpvWorkspacePackageRow = {
  id: string;
  packageType: string;
  status: string;
  label: string;
  updatedAt: string;
};

export type AdminSpvWorkspaceManagementData = {
  opportunities: SpvOpportunityRecord[];
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
  packagesBySpv: Record<string, SpvDocumentPackageRecord[]>;
  closingReviewsBySpv: Record<string, SpvClosingReviewRecord>;
  closingReadinessBySpv: Record<string, ClosingReadinessSummary>;
  companies: Array<{ id: string; name: string }>;
};

export type AdminSpvWorkspaceData = {
  spv: SpvOpportunityRecord;
  company: AdminSpvWorkspaceCompany;
  readiness: {
    operationalStatus: string;
    operationalLabel: string;
    checklistPct: number;
    packagePct: number;
    closingPct: number;
    investorRequirementsPct: number;
    nextAction: string;
    unmetCriteria: Array<{ key: string; label: string; met: boolean }>;
    blockers: string[];
  };
  participation: {
    totalCount: number;
    activeCount: number;
    indicativeTotal: string;
    documentReadyCount: number;
    statusCounts: Record<string, number>;
    requirementStatusCounts: Record<string, number>;
    rows: AdminSpvWorkspaceParticipationRow[];
  };
  requirements: {
    pending: number;
    uploaded: number;
    underReview: number;
    rejected: number;
    approved: number;
    latestUpdates: AdminSpvWorkspaceRequirementUpdate[];
    nextAction: string | null;
  };
  packages: {
    readinessPct: number;
    completeCount: number;
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    issuedCount: number;
    rows: AdminSpvWorkspacePackageRow[];
    blockers: string[];
  };
  closing: {
    review: Pick<SpvClosingReviewRecord, "id" | "status" | "reviewed_at" | "updated_at"> | null;
    summary: ClosingReadinessSummary;
    targetOverride: boolean;
    operationalCloseState: string;
  };
  compliance: {
    openCount: number;
    criticalCount: number;
    highCount: number;
    recentEvents: ComplianceEventRecord[];
    nextAction: string | null;
  };
  timeline: OperationalActivityFeedItem[];
  queueItems: AdminQueueItem[];
  management: AdminSpvWorkspaceManagementData;
};

export function getAdminSpvWorkspaceHref(spvId: string): string {
  return `/admin/spvs/${spvId}`;
}

export function buildSpvReportHref(companyId: string, reportType: string): string {
  const params = new URLSearchParams({ companyId, reportType });
  return `/admin/reports?${params.toString()}`;
}

export function buildSpvFilteredHref(
  base: string,
  spvId: string,
  companyId: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ spv: spvId, company: companyId, ...extra });
  return `${base}?${params.toString()}`;
}
