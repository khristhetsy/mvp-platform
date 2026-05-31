import type { ReadonlyURLSearchParams } from "next/navigation";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";
import type { ComplianceEventRecord, ComplianceEventStatus, ComplianceSeverity } from "@/lib/compliance/types";
import type { InvestorApprovalStatus } from "@/lib/investor/types";
import type { MessageThreadListItem } from "@/lib/messaging/types";
import {
  SPV_OPERATIONAL_READINESS_STATUSES,
  type SpvOperationalReadinessStatus,
} from "@/lib/spv/readiness";
import type {
  SpvOpportunityRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";

export type FilterChip = {
  key: string;
  label: string;
  value: string;
};

export const PRESERVED_QUERY_PARAMS = ["view", "density", "q"] as const;

const CRM_ACTIVITY_TYPES = [
  "expressed_interest",
  "requested_intro",
  "saved_deal",
  "message_sent",
  "meeting_scheduled",
] as const;

export type CrmActivityFilter = (typeof CRM_ACTIVITY_TYPES)[number];

const COMPANY_STATUS_ALIASES = ["pending_review", "published"] as const;
const COMPANY_QUEUE_TYPES = ["remediation"] as const;

const INVESTOR_APPROVAL_STATUSES: InvestorApprovalStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "changes_requested",
];

const COMPLIANCE_STATUSES: ComplianceEventStatus[] = ["open", "under_review", "resolved", "dismissed"];
const COMPLIANCE_SEVERITIES: ComplianceSeverity[] = ["low", "medium", "high", "critical"];

const SPV_STATUSES = ["draft", "under_review", "open", "closed", "canceled"] as const;
const SPV_QUEUE_TYPES = ["investor_documents"] as const;
const INVESTOR_DOC_STATUSES = ["pending", "uploaded", "under_review", "rejected"] as const;

function readParam(params: ReadonlyURLSearchParams | URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim();
  return value ? value : null;
}

function isOneOf<T extends string>(value: string | null, allowed: readonly T[]): value is T {
  return Boolean(value && (allowed as readonly string[]).includes(value));
}

function parseIsoDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function matchesTextFields(query: string, fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(q));
}

export type CrmQueryFilters = {
  activity: CrmActivityFilter | null;
  company: string | null;
  investor: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  q: string;
};

export function parseCrmQueryFilters(params: ReadonlyURLSearchParams | URLSearchParams): CrmQueryFilters {
  const activity = readParam(params, "activity");
  return {
    activity: isOneOf(activity, CRM_ACTIVITY_TYPES) ? activity : null,
    company: readParam(params, "company"),
    investor: readParam(params, "investor"),
    dateFrom: parseIsoDate(readParam(params, "date_from")),
    dateTo: parseIsoDate(readParam(params, "date_to")),
    q: readParam(params, "q") ?? "",
  };
}

export function filterCrmActivities(
  activities: AdminCrmActivityRow[],
  filters: CrmQueryFilters,
): AdminCrmActivityRow[] {
  return activities.filter((row) => {
    if (filters.activity && row.activity_type !== filters.activity) return false;
    if (filters.company && row.company_id !== filters.company) return false;
    if (filters.investor && row.investor_id !== filters.investor) return false;
    if (filters.dateFrom && row.created_at < filters.dateFrom) return false;
    if (filters.dateTo && row.created_at > filters.dateTo) return false;
    if (
      !matchesTextFields(filters.q, [
        row.investor_name,
        row.investor_email,
        row.company_name,
        row.activity_type,
        row.pipeline_stage,
      ])
    ) {
      return false;
    }
    return true;
  });
}

export function filterCrmInvestorPanels(
  panels: {
    interests: Array<Record<string, unknown>>;
    introRequests: Array<Record<string, unknown>>;
    savedDeals: Array<Record<string, unknown>>;
  },
  filters: Pick<CrmQueryFilters, "activity" | "company" | "investor" | "q">,
) {
  const filterRows = (rows: Array<Record<string, unknown>>) =>
    rows.filter((raw) => {
      const companyId = typeof raw.company_id === "string" ? raw.company_id : null;
      const investorId =
        typeof raw.investor_id === "string"
          ? raw.investor_id
          : typeof (raw.profiles as { id?: string } | null)?.id === "string"
            ? (raw.profiles as { id: string }).id
            : null;
      const profile = raw.profiles as { full_name?: string | null; email?: string | null } | null | undefined;
      const company = raw.companies as { company_name?: string | null } | null | undefined;

      if (filters.company && companyId !== filters.company) return false;
      if (filters.investor && investorId !== filters.investor) return false;
      if (
        !matchesTextFields(filters.q, [
          profile?.full_name,
          profile?.email,
          company?.company_name,
          String(raw.status ?? ""),
        ])
      ) {
        return false;
      }
      return true;
    });

  const interests = filterRows(panels.interests);
  const introRequests = filterRows(panels.introRequests);
  const savedDeals = filterRows(panels.savedDeals);

  if (!filters.activity) {
    return { interests, introRequests, savedDeals };
  }

  switch (filters.activity) {
    case "expressed_interest":
      return { interests, introRequests: [], savedDeals: [] };
    case "requested_intro":
      return { interests: [], introRequests, savedDeals: [] };
    case "saved_deal":
      return { interests: [], introRequests: [], savedDeals };
    case "message_sent":
    case "meeting_scheduled":
      return { interests: [], introRequests: [], savedDeals: [] };
    default:
      return { interests, introRequests, savedDeals };
  }
}

export function filterMessageThreads(
  threads: MessageThreadListItem[],
  filters: Pick<CrmQueryFilters, "activity" | "company" | "investor" | "q">,
): MessageThreadListItem[] {
  return threads.filter((thread) => {
    if (filters.activity === "message_sent" && thread.status === "archived") return false;
    if (filters.activity === "meeting_scheduled" && thread.meeting_status !== "scheduled") return false;
    if (filters.company && thread.company_id !== filters.company) return false;
    if (filters.investor && thread.investor_id !== filters.investor) return false;
    if (
      !matchesTextFields(filters.q, [
        thread.company_name,
        thread.investor_name,
        thread.founder_name,
        thread.last_message_preview,
        thread.status,
        thread.meeting_status,
      ])
    ) {
      return false;
    }
    return true;
  });
}

export function shouldShowCrmMessageThreads(filters: CrmQueryFilters): boolean {
  if (!filters.activity) return true;
  return filters.activity === "message_sent" || filters.activity === "meeting_scheduled";
}

export function shouldShowCrmInvestorPanels(filters: CrmQueryFilters): boolean {
  if (!filters.activity) return true;
  return ["expressed_interest", "requested_intro", "saved_deal"].includes(filters.activity);
}

export type CompanyQueryFilters = {
  status: (typeof COMPANY_STATUS_ALIASES)[number] | string | null;
  reviewStatus: string | null;
  queue: (typeof COMPANY_QUEUE_TYPES)[number] | null;
  company: string | null;
  activity: string | null;
  q: string;
};

export function parseCompanyQueryFilters(params: ReadonlyURLSearchParams | URLSearchParams): CompanyQueryFilters {
  const status = readParam(params, "status");
  const reviewStatus = readParam(params, "review_status");
  const queueRaw = readParam(params, "queue");

  return {
    status,
    reviewStatus,
    queue: isOneOf(queueRaw, COMPANY_QUEUE_TYPES) ? queueRaw : null,
    company: readParam(params, "company"),
    activity: readParam(params, "activity"),
    q: readParam(params, "q") ?? "",
  };
}

export function filterCompanies(
  companies: AdminCompanyCardData[],
  filters: CompanyQueryFilters,
): AdminCompanyCardData[] {
  return companies.filter((company) => {
    if (filters.company && company.id !== filters.company) return false;

    if (filters.reviewStatus && company.review_status !== filters.reviewStatus) return false;

    if (filters.status === "pending_review") {
      if (!["pending", "changes_requested", "submitted"].includes(company.review_status ?? "")) {
        return false;
      }
    } else if (filters.status === "published") {
      if (!company.is_published && !company.marketplace_visible) return false;
    } else if (filters.status && filters.status !== "pending_review" && filters.status !== "published") {
      if (company.review_status !== filters.status) return false;
    }

    if (filters.queue === "remediation" && company.founder_remediation_active <= 0) return false;

    if (filters.activity === "company_update" && company.company_updates_published_count <= 0) return false;

    if (
      !matchesTextFields(filters.q, [
        company.company_name,
        company.industry,
        company.founder_name,
        company.founder_email,
        company.review_status,
      ])
    ) {
      return false;
    }

    return true;
  });
}

export type InvestorQueryFilters = {
  status: InvestorApprovalStatus | null;
  approvalStatus: InvestorApprovalStatus | null;
  q: string;
};

export function parseInvestorQueryFilters(params: ReadonlyURLSearchParams | URLSearchParams): InvestorQueryFilters {
  const statusRaw = readParam(params, "status");
  const approvalRaw = readParam(params, "approval_status");

  return {
    status: isOneOf(statusRaw, INVESTOR_APPROVAL_STATUSES) ? statusRaw : null,
    approvalStatus: isOneOf(approvalRaw, INVESTOR_APPROVAL_STATUSES) ? approvalRaw : null,
    q: readParam(params, "q") ?? "",
  };
}

export type InvestorProfileRow = {
  id: string;
  profile_id: string;
  firm_name: string | null;
  approval_status: InvestorApprovalStatus;
  investor_type?: string | null;
  matchingSummary?: unknown;
};

export function filterInvestorProfiles<T extends InvestorProfileRow>(
  profiles: T[],
  filters: InvestorQueryFilters,
  profileLookup?: Map<string, { full_name?: string | null; email?: string | null }>,
): T[] {
  return profiles.filter((row) => {
    const effectiveStatus = filters.approvalStatus ?? filters.status;
    if (effectiveStatus && row.approval_status !== effectiveStatus) return false;

    const profile = profileLookup?.get(row.profile_id);
    if (
      !matchesTextFields(filters.q, [row.firm_name, profile?.full_name, profile?.email, row.approval_status])
    ) {
      return false;
    }

    return true;
  });
}

export type SpvQueryFilters = {
  status: (typeof SPV_STATUSES)[number] | null;
  readiness: SpvOperationalReadinessStatus | null;
  queue: (typeof SPV_QUEUE_TYPES)[number] | null;
  activity: string | null;
  spv: string | null;
  requirement: string | null;
  q: string;
};

export function parseSpvQueryFilters(params: ReadonlyURLSearchParams | URLSearchParams): SpvQueryFilters {
  const status = readParam(params, "status");
  const readiness = readParam(params, "readiness");
  const queueRaw = readParam(params, "queue");

  return {
    status: isOneOf(status, SPV_STATUSES) ? status : null,
    readiness: isOneOf(readiness, SPV_OPERATIONAL_READINESS_STATUSES) ? readiness : null,
    queue: isOneOf(queueRaw, SPV_QUEUE_TYPES) ? queueRaw : null,
    activity: readParam(params, "activity"),
    spv: readParam(params, "spv"),
    requirement: readParam(params, "requirement"),
    q: readParam(params, "q") ?? "",
  };
}

function spvHasInvestorDocumentQueue(
  spvId: string,
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>,
  participationsBySpv: Record<string, { id: string }[]>,
): boolean {
  const parts = participationsBySpv[spvId] ?? [];
  for (const part of parts) {
    const reqs = requirementsByParticipation[part.id] ?? [];
    if (reqs.some((req) => (INVESTOR_DOC_STATUSES as readonly string[]).includes(req.status))) {
      return true;
    }
  }
  return false;
}

export function filterSpvOpportunities(
  opportunities: SpvOpportunityRecord[],
  filters: SpvQueryFilters,
  context: {
    requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
    participationsBySpv: Record<string, { id: string }[]>;
    companiesById?: Map<string, string>;
  },
): SpvOpportunityRecord[] {
  let rows = [...opportunities];

  if (filters.spv) {
    rows = rows.filter((row) => row.id === filters.spv);
  }

  if (filters.status) {
    rows = rows.filter((row) => (row.status ?? "draft") === filters.status);
  }

  if (filters.readiness) {
    rows = rows.filter((row) => row.operational_readiness_status === filters.readiness);
  }

  if (filters.queue === "investor_documents") {
    rows = rows.filter((row) =>
      spvHasInvestorDocumentQueue(row.id, context.requirementsByParticipation, context.participationsBySpv),
    );
  }

  if (filters.requirement) {
    rows = rows.filter((row) => {
      const parts = context.participationsBySpv[row.id] ?? [];
      return parts.some((part) =>
        (context.requirementsByParticipation[part.id] ?? []).some((req) => req.id === filters.requirement),
      );
    });
  }

  if (filters.activity === "recent") {
    rows.sort((a, b) => {
      const aTs = Date.parse(a.updated_at ?? a.created_at);
      const bTs = Date.parse(b.updated_at ?? b.created_at);
      return bTs - aTs;
    });
  }

  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    rows = rows.filter((row) => {
      const companyName = context.companiesById?.get(row.company_id) ?? row.company_id;
      return (
        row.name.toLowerCase().includes(q) ||
        companyName.toLowerCase().includes(q) ||
        (row.status ?? "").toLowerCase().includes(q) ||
        (row.operational_readiness_status ?? "").toLowerCase().includes(q)
      );
    });
  }

  return rows;
}

export type ComplianceQueryFilters = {
  status: ComplianceEventStatus | null;
  severity: ComplianceSeverity | null;
  company: string | null;
  investor: string | null;
  event: string | null;
  q: string;
};

export function parseComplianceQueryFilters(
  params: ReadonlyURLSearchParams | URLSearchParams,
): ComplianceQueryFilters {
  const status = readParam(params, "status");
  const severity = readParam(params, "severity");

  return {
    status: isOneOf(status, COMPLIANCE_STATUSES) ? status : null,
    severity: isOneOf(severity, COMPLIANCE_SEVERITIES) ? severity : null,
    company: readParam(params, "company"),
    investor: readParam(params, "investor"),
    event: readParam(params, "event"),
    q: readParam(params, "q") ?? "",
  };
}

export function filterComplianceEvents(
  events: ComplianceEventRecord[],
  filters: ComplianceQueryFilters,
): ComplianceEventRecord[] {
  return events.filter((event) => {
    if (filters.event && event.id !== filters.event) return false;
    if (filters.status && event.status !== filters.status) return false;
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.company && event.company_id !== filters.company) return false;
    if (filters.investor && event.investor_id !== filters.investor) return false;
    if (
      !matchesTextFields(filters.q, [
        event.title,
        event.description,
        event.event_type,
        event.source,
        event.status,
        event.severity,
      ])
    ) {
      return false;
    }
    return true;
  });
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildCrmFilterChips(filters: CrmQueryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.activity) chips.push({ key: "activity", label: "Activity", value: formatLabel(filters.activity) });
  if (filters.company) chips.push({ key: "company", label: "Company", value: filters.company });
  if (filters.investor) chips.push({ key: "investor", label: "Investor", value: filters.investor });
  if (filters.dateFrom) chips.push({ key: "date_from", label: "From", value: filters.dateFrom.slice(0, 10) });
  if (filters.dateTo) chips.push({ key: "date_to", label: "To", value: filters.dateTo.slice(0, 10) });
  if (filters.q.trim()) chips.push({ key: "q", label: "Search", value: filters.q.trim() });
  return chips;
}

export function buildCompanyFilterChips(filters: CompanyQueryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.status) chips.push({ key: "status", label: "Status", value: formatLabel(filters.status) });
  if (filters.reviewStatus) chips.push({ key: "review_status", label: "Review", value: formatLabel(filters.reviewStatus) });
  if (filters.queue) chips.push({ key: "queue", label: "Queue", value: formatLabel(filters.queue) });
  if (filters.company) chips.push({ key: "company", label: "Company", value: filters.company });
  if (filters.activity) chips.push({ key: "activity", label: "Activity", value: formatLabel(filters.activity) });
  if (filters.q.trim()) chips.push({ key: "q", label: "Search", value: filters.q.trim() });
  return chips;
}

export function buildInvestorFilterChips(filters: InvestorQueryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.status) chips.push({ key: "status", label: "Status", value: formatLabel(filters.status) });
  if (filters.approvalStatus) {
    chips.push({ key: "approval_status", label: "Approval", value: formatLabel(filters.approvalStatus) });
  }
  if (filters.q.trim()) chips.push({ key: "q", label: "Search", value: filters.q.trim() });
  return chips;
}

export function buildSpvFilterChips(filters: SpvQueryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.status) chips.push({ key: "status", label: "Status", value: formatLabel(filters.status) });
  if (filters.readiness) chips.push({ key: "readiness", label: "Readiness", value: formatLabel(filters.readiness) });
  if (filters.queue) chips.push({ key: "queue", label: "Queue", value: formatLabel(filters.queue) });
  if (filters.activity) chips.push({ key: "activity", label: "Activity", value: formatLabel(filters.activity) });
  if (filters.spv) chips.push({ key: "spv", label: "SPV", value: filters.spv });
  if (filters.requirement) chips.push({ key: "requirement", label: "Requirement", value: filters.requirement });
  if (filters.q.trim()) chips.push({ key: "q", label: "Search", value: filters.q.trim() });
  return chips;
}

export function buildComplianceFilterChips(filters: ComplianceQueryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.status) chips.push({ key: "status", label: "Status", value: formatLabel(filters.status) });
  if (filters.severity) chips.push({ key: "severity", label: "Severity", value: formatLabel(filters.severity) });
  if (filters.company) chips.push({ key: "company", label: "Company", value: filters.company });
  if (filters.investor) chips.push({ key: "investor", label: "Investor", value: filters.investor });
  if (filters.event) chips.push({ key: "event", label: "Event", value: filters.event });
  if (filters.q.trim()) chips.push({ key: "q", label: "Search", value: filters.q.trim() });
  return chips;
}

export type AdminFilterPage = "crm" | "companies" | "investors" | "spvs" | "compliance";

const DRILLDOWN_KEYS: Record<AdminFilterPage, string[]> = {
  crm: ["activity", "company", "investor", "date_from", "date_to"],
  companies: ["status", "review_status", "queue", "company", "activity"],
  investors: ["status", "approval_status"],
  spvs: ["status", "readiness", "queue", "activity", "spv", "requirement"],
  compliance: ["status", "severity", "company", "investor", "event"],
};

export function clearDrilldownParams(
  params: URLSearchParams,
  page: AdminFilterPage,
  options?: { keepSearch?: boolean },
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const key of DRILLDOWN_KEYS[page]) {
    next.delete(key);
  }
  if (!options?.keepSearch) {
    next.delete("q");
  }
  return next;
}

export function hasDrilldownFilters(page: AdminFilterPage, params: ReadonlyURLSearchParams | URLSearchParams): boolean {
  return DRILLDOWN_KEYS[page].some((key) => Boolean(readParam(params, key))) || Boolean(readParam(params, "q"));
}
