import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";

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
};
