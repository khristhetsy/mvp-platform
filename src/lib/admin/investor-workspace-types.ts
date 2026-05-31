import type { ComplianceEventRecord } from "@/lib/compliance/types";
import type { InvestorProfileRecord } from "@/lib/investor/types";
import type { InvestorMatchingSummary } from "@/lib/matching/admin-matching-summaries";
import type { OperationalActivityFeedItem } from "@/lib/operational-activity/types";
import type { AdminQueueItem } from "@/lib/queues/admin-queues";

export type AdminInvestorWorkspaceProfile = InvestorProfileRecord & {
  profiles: { id: string; full_name: string | null; email: string | null; created_at: string } | null;
  matchingSummary?: InvestorMatchingSummary;
};

export type AdminInvestorWorkspaceCompanyRelation = {
  companyId: string;
  companyName: string;
  sources: string[];
};

export type AdminInvestorWorkspaceSpvSummary = {
  id: string;
  participationId: string;
  name: string;
  companyId: string;
  companyName: string;
  status: string;
  indicativeAmount: string;
  documentReadinessPct: number;
  pendingRequirements: number;
  nextAction: string;
};

export type AdminInvestorWorkspaceData = {
  investor: AdminInvestorWorkspaceProfile;
  profileId: string;
  engagement: {
    savedDeals: number;
    interests: number;
    introRequests: number;
    messageThreads: number;
    meetingsScheduled: number;
    pledgeTotal: number;
    interestAmountTotal: number;
  };
  companies: AdminInvestorWorkspaceCompanyRelation[];
  spvParticipations: AdminInvestorWorkspaceSpvSummary[];
  compliance: {
    openCount: number;
    criticalCount: number;
    highCount: number;
    recentEvents: ComplianceEventRecord[];
    nextAction: string | null;
    adminFeedback: string | null;
  };
  timeline: OperationalActivityFeedItem[];
  queueItems: AdminQueueItem[];
};

export function getAdminInvestorWorkspaceHref(profileId: string): string {
  return `/admin/investors/${profileId}`;
}

export function buildInvestorReportHref(profileId: string, reportType: string): string {
  const params = new URLSearchParams({ investorId: profileId, reportType });
  return `/admin/reports?${params.toString()}`;
}

export function buildInvestorFilteredHref(
  base: string,
  profileId: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ investor: profileId, ...extra });
  return `${base}?${params.toString()}`;
}
