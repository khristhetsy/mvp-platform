import {
  buildClosingReadinessSummary,
  computeClosingReadinessCriteria,
  countCriticalOpenComplianceForCompany,
} from "@/lib/spv/closing-reviews";
import { getSpvParticipationTotals } from "@/lib/spv/display";
import { computeParticipationReadinessPct } from "@/lib/spv/participation-display";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AdminReportFilters, AdminReportPayload } from "@/lib/reports/admin-reports";

const PREVIEW_ROW_LIMIT = 25;
const EXPORT_ROW_LIMIT = 2000;

const BASE_PRIVACY_NOTICE =
  "Internal staff report. Excludes OAuth tokens, encrypted credentials, private founder contact PII (email/phone), investor uploaded documents, storage file paths, message bodies, and internal legal/admin notes.";

export const SPV_READINESS_REPORT_DISCLAIMER =
  "This report is for operational readiness tracking only. It is not a legal opinion, offering document, securities confirmation, or closing statement.";

const SPV_NOTIFICATION_TYPES = [
  "spv_opportunity_opened",
  "spv_investor_invited",
  "spv_interest_expressed",
  "spv_participation_status_changed",
  "spv_checklist_complete",
  "spv_document_ready",
  "spv_requirements_requested",
  "spv_requirement_reviewed",
  "spv_requirement_uploaded",
  "spv_investor_aggregate_changed",
  "spv_ready_for_legal_docs",
  "spv_investor_documents_pending_review",
  "spv_target_amount_reached",
  "spv_packages_seeded",
  "spv_packages_approved",
  "spv_subscription_package_issued",
  "spv_ready_for_final_review",
  "spv_approved_for_closing",
  "spv_operationally_closed",
] as const;

function inDateRange(value: string | null | undefined, filters: AdminReportFilters): boolean {
  if (!value) {
    return true;
  }
  const ts = new Date(value).getTime();
  if (filters.dateFrom && ts < new Date(filters.dateFrom).getTime()) {
    return false;
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    if (ts > end.getTime()) {
      return false;
    }
  }
  return true;
}

function limitRows<T>(rows: T[], preview: boolean): T[] {
  const max = preview ? PREVIEW_ROW_LIMIT : EXPORT_ROW_LIMIT;
  return rows.slice(0, max);
}

function averageParticipationRequirementPct(
  participations: SpvParticipationRecord[],
  requirements: SpvParticipationRequirementRecord[],
) {
  const active = participations.filter((row) => !["declined", "canceled"].includes(row.status));
  if (active.length === 0) {
    return 0;
  }
  const pcts = active.map((part) => {
    const partReqs = requirements.filter((r) => r.spv_participation_id === part.id);
    return part.document_readiness_pct ?? computeParticipationReadinessPct(partReqs);
  });
  return Math.round(pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length);
}

function summarizeNotificationActivity(
  rows: { type: string; created_at: string }[],
) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.type] = (counts[row.type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}:${count}`)
    .join("; ");
}

export async function generateSpvReadinessReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let query = admin.from("spv_opportunities").select(
    "id, company_id, name, status, target_amount, minimum_commitment, description, checklist_readiness_pct, operational_readiness_status, package_readiness_pct, closing_readiness_pct, investor_pending_requirements_count, investors_document_ready_count, closing_target_override, created_at, updated_at, companies(id, company_name, industry, country, review_status, is_published)",
  );

  if (filters.companyId) {
    query = query.eq("company_id", filters.companyId);
  }
  if (filters.spvStatus) {
    query = query.eq("status", filters.spvStatus);
  }
  if (filters.operationalReadinessStatus) {
    query = query.eq("operational_readiness_status", filters.operationalReadinessStatus);
  }

  const { data: spvRows, error } = await query
    .order("updated_at", { ascending: false })
    .limit(EXPORT_ROW_LIMIT);

  if (error) {
    return {
      meta: {
        reportType: "spv_readiness",
        generatedAt,
        preview,
        filters,
        privacyNotice: `${BASE_PRIVACY_NOTICE} ${SPV_READINESS_REPORT_DISCLAIMER}`,
      },
      summary: { error: error.message },
      sections: {},
    };
  }

  let opportunities = (spvRows ?? []).filter((row) =>
    inDateRange(row.updated_at, filters),
  ) as unknown as (SpvOpportunityRecord & {
    companies?: {
      id?: string;
      company_name?: string;
      industry?: string | null;
      country?: string | null;
      review_status?: string | null;
      is_published?: boolean;
    } | null;
  })[];

  const spvIds = opportunities.map((row) => row.id);
  if (spvIds.length === 0) {
    return emptySpvReadinessPayload(filters, preview, generatedAt);
  }

  const [
    participationsRes,
    requirementsRes,
    checklistRes,
    packagesRes,
    reviewsRes,
    complianceRes,
    notificationsRes,
  ] = await Promise.all([
    admin.from("spv_participations").select("id, spv_opportunity_id, status, indicative_amount, document_readiness_pct").in("spv_opportunity_id", spvIds),
    admin.from("spv_participation_requirements").select("id, spv_opportunity_id, spv_participation_id, status, required").in("spv_opportunity_id", spvIds),
    admin.from("spv_checklist_items").select("id, spv_opportunity_id, status, required").in("spv_opportunity_id", spvIds),
    admin.from("spv_document_packages").select("id, spv_opportunity_id, status, package_type").in("spv_opportunity_id", spvIds),
    admin.from("spv_closing_reviews").select("id, spv_opportunity_id, status, reviewed_at, updated_at").in("spv_opportunity_id", spvIds),
    admin
      .from("compliance_events")
      .select("id, company_id, severity, status, created_at")
      .in(
        "company_id",
        [...new Set(opportunities.map((row) => row.company_id))],
      ),
    admin
      .from("notifications")
      .select("id, type, entity_id, created_at, title")
      .eq("entity_type", "spv_opportunity")
      .in("entity_id", spvIds)
      .in("type", [...SPV_NOTIFICATION_TYPES]),
  ]);

  const participationsBySpv = groupByKey(
    (participationsRes.data ?? []) as SpvParticipationRecord[],
    "spv_opportunity_id",
  );
  const requirementsBySpv = groupByKey(
    (requirementsRes.data ?? []) as SpvParticipationRequirementRecord[],
    "spv_opportunity_id",
  );
  const checklistBySpv = groupByKey(
    (checklistRes.data ?? []) as SpvChecklistItemRecord[],
    "spv_opportunity_id",
  );
  const packagesBySpv = groupByKey(
    (packagesRes.data ?? []) as SpvDocumentPackageRecord[],
    "spv_opportunity_id",
  );
  const reviewsBySpv = new Map(
    ((reviewsRes.data ?? []) as SpvClosingReviewRecord[]).map((row) => [
      row.spv_opportunity_id,
      row,
    ]),
  );

  const complianceByCompany = new Map<string, { total: number; openCritical: number }>();
  for (const event of complianceRes.data ?? []) {
    if (!event.company_id || !inDateRange(event.created_at, filters)) {
      continue;
    }
    const current = complianceByCompany.get(event.company_id) ?? { total: 0, openCritical: 0 };
    current.total += 1;
    if (
      event.severity === "critical" &&
      ["open", "under_review"].includes(event.status)
    ) {
      current.openCritical += 1;
    }
    complianceByCompany.set(event.company_id, current);
  }

  const notificationsBySpv = new Map<string, { type: string; created_at: string }[]>();
  for (const row of notificationsRes.data ?? []) {
    if (!row.entity_id || !inDateRange(row.created_at, filters)) {
      continue;
    }
    const list = notificationsBySpv.get(row.entity_id) ?? [];
    list.push({ type: row.type, created_at: row.created_at });
    notificationsBySpv.set(row.entity_id, list);
  }

  const companyIds = [...new Set(opportunities.map((row) => row.company_id))];
  const criticalByCompany: Record<string, number> = {};
  for (const companyId of companyIds) {
    const counted = await countCriticalOpenComplianceForCompany(admin, companyId);
    criticalByCompany[companyId] = counted.count;
  }

  if (filters.closingReviewStatus) {
    opportunities = opportunities.filter((spv) => {
      const review = reviewsBySpv.get(spv.id);
      const status = review?.status ?? "not_started";
      return status === filters.closingReviewStatus;
    });
  }

  const reportRows: Record<string, unknown>[] = [];

  for (const spv of opportunities) {
    const company = Array.isArray(spv.companies) ? spv.companies[0] : spv.companies;
    const participations = participationsBySpv.get(spv.id) ?? [];
    const requirements = requirementsBySpv.get(spv.id) ?? [];
    const checklist = checklistBySpv.get(spv.id) ?? [];
    const packages = packagesBySpv.get(spv.id) ?? [];
    const review = reviewsBySpv.get(spv.id);
    const active = participations.filter((row) => !["declined", "canceled"].includes(row.status));
    const totals = getSpvParticipationTotals(active);
    const compliance = complianceByCompany.get(spv.company_id) ?? { total: 0, openCritical: 0 };
    const criticalCount = criticalByCompany[spv.company_id] ?? 0;

    const closingCriteria = computeClosingReadinessCriteria({
      spv,
      checklist,
      participations,
      requirements,
      packages,
      criticalComplianceOpenCount: criticalCount,
    });
    const closingSummary = buildClosingReadinessSummary(closingCriteria);
    const pendingBlockers = closingCriteria.filter((row) => !row.met).map((row) => row.label);

    const activityRows = notificationsBySpv.get(spv.id) ?? [];

    reportRows.push({
      spv_id: spv.id,
      spv_name: spv.name,
      company_id: spv.company_id,
      company_name: company?.company_name ?? null,
      company_industry: company?.industry ?? null,
      company_country: company?.country ?? null,
      company_review_status: company?.review_status ?? null,
      company_published: company?.is_published ?? false,
      spv_status: spv.status,
      operational_readiness_status: spv.operational_readiness_status ?? null,
      target_amount: spv.target_amount,
      indicative_participation_total: totals.indicativeTotal,
      investor_count: totals.participantCount,
      checklist_readiness_pct: spv.checklist_readiness_pct ?? 0,
      investor_requirement_readiness_pct: averageParticipationRequirementPct(
        participations,
        requirements,
      ),
      document_package_readiness_pct: spv.package_readiness_pct ?? 0,
      closing_readiness_pct: spv.closing_readiness_pct ?? closingSummary.readinessPct,
      closing_review_status: review?.status ?? "not_started",
      closing_review_updated_at: review?.updated_at ?? null,
      pending_blockers: pendingBlockers.join("; ") || "None",
      pending_blocker_count: pendingBlockers.length,
      compliance_events_count: compliance.total,
      open_critical_compliance_count: compliance.openCritical,
      notification_activity_summary: summarizeNotificationActivity(activityRows) || "None",
      notification_count: activityRows.length,
      investors_document_ready_count: spv.investors_document_ready_count ?? 0,
      investor_pending_requirements_count: spv.investor_pending_requirements_count ?? 0,
      closing_target_override: Boolean(spv.closing_target_override),
      spv_created_at: spv.created_at,
      spv_updated_at: spv.updated_at,
    });
  }

  const limited = limitRows(reportRows, preview);

  const openBlockers = limited.reduce(
    (sum, row) => sum + Number(row.pending_blocker_count ?? 0),
    0,
  );

  return {
    meta: {
      reportType: "spv_readiness",
      generatedAt,
      preview,
      filters,
      privacyNotice: `${BASE_PRIVACY_NOTICE} ${SPV_READINESS_REPORT_DISCLAIMER}`,
    },
    summary: {
      spvsIncluded: limited.length,
      totalIndicativeParticipation: limited.reduce(
        (sum, row) => sum + Number(row.indicative_participation_total ?? 0),
        0,
      ),
      totalInvestors: limited.reduce((sum, row) => sum + Number(row.investor_count ?? 0), 0),
      averageChecklistReadinessPct:
        limited.length > 0
          ? Math.round(
              limited.reduce((sum, row) => sum + Number(row.checklist_readiness_pct ?? 0), 0) /
                limited.length,
            )
          : 0,
      averageClosingReadinessPct:
        limited.length > 0
          ? Math.round(
              limited.reduce((sum, row) => sum + Number(row.closing_readiness_pct ?? 0), 0) /
                limited.length,
            )
          : 0,
      spvsWithPendingBlockers: limited.filter((row) => Number(row.pending_blocker_count) > 0).length,
      totalPendingBlockerItems: openBlockers,
      spvsApprovedForClosing: limited.filter(
        (row) => row.closing_review_status === "approved_for_closing",
      ).length,
      spvsOperationallyClosed: limited.filter(
        (row) =>
          row.closing_review_status === "closed_operationally" || row.spv_status === "closed",
      ).length,
    },
    sections: {
      spv_readiness_rows: limited,
      notification_type_totals: buildNotificationTypeTotals(notificationsRes.data ?? [], filters),
    },
  };
}

function emptySpvReadinessPayload(
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): AdminReportPayload {
  return {
    meta: {
      reportType: "spv_readiness",
      generatedAt,
      preview,
      filters,
      privacyNotice: `${BASE_PRIVACY_NOTICE} ${SPV_READINESS_REPORT_DISCLAIMER}`,
    },
    summary: {
      spvsIncluded: 0,
      totalIndicativeParticipation: 0,
      totalInvestors: 0,
      averageChecklistReadinessPct: 0,
      averageClosingReadinessPct: 0,
      spvsWithPendingBlockers: 0,
      totalPendingBlockerItems: 0,
      spvsApprovedForClosing: 0,
      spvsOperationallyClosed: 0,
    },
    sections: {
      spv_readiness_rows: [],
      notification_type_totals: [],
    },
  };
}

function groupByKey<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T & string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = String(row[key]);
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

function buildNotificationTypeTotals(
  rows: { type: string; created_at: string; entity_id: string | null }[],
  filters: AdminReportFilters,
) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!inDateRange(row.created_at, filters)) {
      continue;
    }
    counts[row.type] = (counts[row.type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([notification_type, count]) => ({ notification_type, count }));
}
