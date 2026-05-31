/** Admin command-center drill-down destinations. Extend for founder/investor dashboards later. */
export const DRILLDOWN_LINKS = {
  saved_deals: "/admin/crm?activity=saved_deal",
  intro_requests: "/admin/crm?activity=requested_intro",
  investor_interests: "/admin/crm?activity=expressed_interest",
  messages: "/admin/crm?activity=message_sent",
  meetings: "/admin/crm?activity=meeting_scheduled",
  spv_activity: "/admin/spvs",
  compliance_open: "/admin/compliance?status=open",
  compliance_critical: "/admin/compliance?severity=critical",
  companies_pending: "/admin/companies?status=pending_review",
  companies_published: "/admin/companies?status=published",
  companies_all: "/admin/companies",
  investors_pending: "/admin/investors?status=submitted",
  investors_all: "/admin/investors",
  reports: "/admin/reports",
  platform_activity: "/admin/analytics?section=platform_activity",
  subscriptions: "/admin/analytics?section=subscriptions",
  notifications: "/admin/analytics?section=notifications",
  upgrade_requests: "/admin/billing",
  platform_health: "/admin/system-health",
  company_updates: "/admin/companies?activity=company_update",
  spv_recent: "/admin/spvs?activity=recent",
} as const;

export type DrilldownKey = keyof typeof DRILLDOWN_LINKS;

export function getCompanyWorkspaceHref(companyId: string): string {
  return `/admin/companies/${companyId}`;
}

export function getInvestorWorkspaceHref(profileId: string): string {
  return `/admin/investors/${profileId}`;
}

export function getAdminSpvWorkspaceHref(spvId: string): string {
  return `/admin/spvs/${spvId}`;
}

export function getDrilldownHref(key: DrilldownKey): string {
  return DRILLDOWN_LINKS[key];
}

export function getCrmActivityHref(activityType: string): string {
  return `/admin/crm?activity=${encodeURIComponent(activityType)}`;
}

export function getCompanyStatusHref(status: string): string {
  const normalized = status === "pending" ? "pending_review" : status.replace(/\s+/g, "_");
  return `/admin/companies?status=${encodeURIComponent(normalized)}`;
}

export function getInvestorStatusHref(status: string): string {
  return `/admin/investors?status=${encodeURIComponent(status)}`;
}

/** Platform activity graph category keys → filtered module URLs. */
export function getPlatformActivityCategoryHref(categoryKey: string): string {
  switch (categoryKey) {
    case "interests":
      return getDrilldownHref("investor_interests");
    case "intros":
      return getDrilldownHref("intro_requests");
    case "saved":
      return getDrilldownHref("saved_deals");
    case "messages":
      return getDrilldownHref("messages");
    case "meetings":
      return getDrilldownHref("meetings");
    case "updates":
      return getDrilldownHref("company_updates");
    case "spv":
      return getDrilldownHref("spv_recent");
    default:
      return getDrilldownHref("platform_activity");
  }
}

/** Recent activity timeline row → best available destination. */
export function getTimelineActivityHref(activityType: string): string {
  if (activityType === "spv_interest_expressed") {
    return getDrilldownHref("spv_recent");
  }
  if (activityType === "report_viewed") {
    return getDrilldownHref("reports");
  }
  return getCrmActivityHref(activityType);
}

/** Investor activity panel row → CRM filtered view (company-scoped admin route N/A). */
export function getInvestorPanelHref(panel: "interests" | "intros" | "saved"): string {
  switch (panel) {
    case "interests":
      return getDrilldownHref("investor_interests");
    case "intros":
      return getDrilldownHref("intro_requests");
    case "saved":
      return getDrilldownHref("saved_deals");
  }
}

export function getInvestorActivityRowHref(
  panel: "interests" | "intros" | "saved",
  raw: Record<string, unknown>,
): string {
  const investorId =
    typeof raw.investor_id === "string"
      ? raw.investor_id
      : typeof (raw.profiles as { id?: string } | null)?.id === "string"
        ? (raw.profiles as { id: string }).id
        : null;
  if (investorId) {
    return getInvestorWorkspaceHref(investorId);
  }
  const companyId = typeof raw.company_id === "string" ? raw.company_id : null;
  if (companyId) {
    return getCompanyWorkspaceHref(companyId);
  }
  return getInvestorPanelHref(panel);
}

export type AdminKpiDrilldownKey =
  | "total_companies"
  | "total_investors"
  | "active_raises"
  | "pending_reviews"
  | "platform_health"
  | "compliance_open"
  | "spv_readiness"
  | "upgrade_requests";

export function getAdminKpiHref(key: AdminKpiDrilldownKey): string {
  switch (key) {
    case "total_companies":
      return getDrilldownHref("companies_all");
    case "total_investors":
      return getDrilldownHref("investors_all");
    case "active_raises":
      return getDrilldownHref("companies_published");
    case "pending_reviews":
      return getDrilldownHref("companies_pending");
    case "platform_health":
      return getDrilldownHref("platform_health");
    case "compliance_open":
      return getDrilldownHref("compliance_open");
    case "spv_readiness":
      return getDrilldownHref("spv_activity");
    case "upgrade_requests":
      return getDrilldownHref("upgrade_requests");
  }
}

export type AdminOperationsControlKey =
  | "pending_company_reviews"
  | "investor_approvals"
  | "compliance_queue"
  | "spv_readiness"
  | "reports"
  | "system_health";

export function getAdminOperationsControlHref(key: AdminOperationsControlKey): string {
  switch (key) {
    case "pending_company_reviews":
      return "/admin/queues?queue=company_reviews";
    case "investor_approvals":
      return "/admin/queues?queue=investor_approvals";
    case "compliance_queue":
      return "/admin/queues?queue=compliance_escalations";
    case "spv_readiness":
      return "/admin/queues?queue=spv_blockers";
    case "reports":
      return "/admin/queues?queue=imports_exports";
    case "system_health":
      return getDrilldownHref("platform_health");
  }
}
