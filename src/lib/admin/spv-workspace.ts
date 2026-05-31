import type {
  AdminSpvWorkspaceCompany,
  AdminSpvWorkspaceData,
  AdminSpvWorkspacePackageRow,
  AdminSpvWorkspaceParticipationRow,
  AdminSpvWorkspaceRequirementUpdate,
} from "@/lib/admin/spv-workspace-types";
import type { ComplianceEventRecord } from "@/lib/compliance/types";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import {
  getAdminQueueItems,
  type AdminQueueItem,
  type AdminQueueType,
} from "@/lib/queues/admin-queues";
import { listAdminChecklistGrouped } from "@/lib/spv/checklist";
import {
  buildClosingReadinessSummary,
  computeClosingReadinessCriteria,
  countCriticalOpenComplianceForCompany,
  listAdminClosingReviewsBySpv,
} from "@/lib/spv/closing-reviews";
import { formatClosingReviewStatusLabel } from "@/lib/spv/closing-review-display";
import { computePackageReadinessPct, formatPackageTypeLabel } from "@/lib/spv/document-package-display";
import { listAdminPackagesGrouped } from "@/lib/spv/document-packages";
import { computeChecklistReadinessPct, formatSpvCurrency, getSpvParticipationTotals } from "@/lib/spv/display";
import { computeParticipationReadinessPct } from "@/lib/spv/participation-display";
import { listAdminRequirementsGrouped } from "@/lib/spv/participation-requirements";
import {
  buildSpvReadinessContext,
  computeSpvOperationalReadinessStatus,
  formatOperationalReadinessLabel,
  getSpvNextAction,
  type SpvOperationalReadinessStatus,
} from "@/lib/spv/readiness";
import { listSpvParticipationsForOpportunity } from "@/lib/spv/spv-workflow";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvDocumentPackageStatus,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const TIMELINE_LIMIT = 25;
const COMPLIANCE_LIMIT = 10;
const PARTICIPATION_LIMIT = 25;
const REQUIREMENT_UPDATE_LIMIT = 12;
const QUEUE_TYPES_FOR_SPV: AdminQueueType[] = [
  "spv_blockers",
  "investor_documents",
  "compliance_escalations",
];

const COMPLETE_PACKAGE_STATUSES: SpvDocumentPackageStatus[] = ["approved", "issued", "archived"];

function countByStatus<T extends { status: string }>(rows: T[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

function investorNameFromParticipation(part: SpvParticipationRecord): string {
  const profile = Array.isArray(part.profiles) ? part.profiles[0] : part.profiles;
  return profile?.full_name ?? profile?.email ?? "Investor";
}

function investorNameFromRequirement(
  req: SpvParticipationRequirementRecord,
  participationById: Map<string, SpvParticipationRecord>,
): string {
  const part = participationById.get(req.spv_participation_id);
  if (part) return investorNameFromParticipation(part);
  const profile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles;
  return profile?.full_name ?? profile?.email ?? "Investor";
}

async function loadSpvRow(admin: ReturnType<typeof createServiceRoleClient>, spvId: string) {
  const { data, error } = await admin
    .from("spv_opportunities")
    .select("*, companies(company_name, slug)")
    .eq("id", spvId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SpvOpportunityRecord | null) ?? null;
}

async function loadSpvQueueItems(
  admin: ReturnType<typeof createServiceRoleClient>,
  spvId: string,
  companyId: string,
): Promise<AdminQueueItem[]> {
  const batches = await Promise.all(
    QUEUE_TYPES_FOR_SPV.map((queueType) => getAdminQueueItems(admin, queueType, { limit: 40 })),
  );

  return batches
    .flat()
    .filter((item) => {
      if (item.spv_id === spvId) return true;
      if (item.queue_type === "compliance_escalations" && item.company_id === companyId) return true;
      return false;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 15);
}

function buildPackageBlockers(packages: SpvDocumentPackageRecord[]): string[] {
  const blockers: string[] = [];
  for (const pkg of packages) {
    if (!COMPLETE_PACKAGE_STATUSES.includes(pkg.status as SpvDocumentPackageStatus)) {
      blockers.push(`${formatPackageTypeLabel(pkg.package_type)} — ${pkg.status.replace(/_/g, " ")}`);
    }
  }
  return blockers.slice(0, 6);
}

function deriveRequirementsNextAction(counts: Record<string, number>): string | null {
  if ((counts.rejected ?? 0) > 0) return "Review rejected investor requirements";
  if ((counts.under_review ?? 0) > 0) return "Complete requirement reviews";
  if ((counts.uploaded ?? 0) > 0) return "Review uploaded investor requirements";
  if ((counts.pending ?? 0) > 0) return "Follow up on pending investor requirements";
  return null;
}

export async function getAdminSpvWorkspace(spvId: string): Promise<AdminSpvWorkspaceData | null> {
  const admin = createServiceRoleClient();
  const spv = await loadSpvRow(admin, spvId);

  if (!spv) {
    return null;
  }

  const companyRaw = Array.isArray(spv.companies) ? spv.companies[0] : spv.companies;
  const company: AdminSpvWorkspaceCompany = {
    id: spv.company_id,
    name: companyRaw?.company_name ?? "Unknown company",
    slug: companyRaw?.slug ?? null,
  };

  const [
    checklistResult,
    requirementsResult,
    packagesResult,
    participationsResult,
    closingReviewsResult,
    criticalCompliance,
    timelineFeed,
    complianceAll,
  ] = await Promise.all([
    listAdminChecklistGrouped(admin, [spvId]),
    listAdminRequirementsGrouped(admin, [spvId]),
    listAdminPackagesGrouped(admin, [spvId]),
    listSpvParticipationsForOpportunity(admin, spvId),
    listAdminClosingReviewsBySpv(admin, [spvId]),
    countCriticalOpenComplianceForCompany(admin, spv.company_id),
    getOperationalActivityFeed(admin, { spvId, limit: TIMELINE_LIMIT }),
    admin
      .from("compliance_events")
      .select("*")
      .eq("company_id", spv.company_id)
      .order("created_at", { ascending: false })
      .limit(COMPLIANCE_LIMIT),
  ]);

  const checklist = ("data" in checklistResult ? checklistResult.data?.[spvId] : []) ?? [];
  const requirementsByParticipation =
    ("data" in requirementsResult ? requirementsResult.data : {}) ?? {};
  const packages = ("data" in packagesResult ? packagesResult.data?.[spvId] : []) ?? [];
  const participations = (participationsResult.data ?? []).slice(0, PARTICIPATION_LIMIT) as SpvParticipationRecord[];
  const closingReviewsBySpv =
    ("data" in closingReviewsResult ? closingReviewsResult.data : {}) ?? {};
  const closingReview = closingReviewsBySpv[spvId] ?? null;

  const requirements: SpvParticipationRequirementRecord[] = [];
  for (const part of participations) {
    requirements.push(...(requirementsByParticipation[part.id] ?? []));
  }

  const participationById = new Map(participations.map((row) => [row.id, row]));
  const activeParticipations = participations.filter((row) => !["declined", "canceled"].includes(row.status));
  const totals = getSpvParticipationTotals(activeParticipations);

  const readinessCtx = buildSpvReadinessContext(spv, checklist, participations, requirementsByParticipation);
  const operationalStatus =
    (spv.operational_readiness_status as SpvOperationalReadinessStatus | null) ??
    computeSpvOperationalReadinessStatus(readinessCtx);
  const checklistPct = spv.checklist_readiness_pct ?? computeChecklistReadinessPct(checklist);
  const packagePct = spv.package_readiness_pct ?? computePackageReadinessPct(packages);
  const closingCriteria = computeClosingReadinessCriteria({
    spv,
    checklist,
    participations,
    requirements,
    packages,
    criticalComplianceOpenCount: criticalCompliance.count,
  });
  const closingSummary = buildClosingReadinessSummary(closingCriteria);
  const closingPct = spv.closing_readiness_pct ?? closingSummary.readinessPct;

  const requirementDone = requirements.filter((row) => ["approved", "waived"].includes(row.status)).length;
  const investorRequirementsPct = requirements.length
    ? Math.round((requirementDone / requirements.length) * 100)
    : 0;

  const unmetCriteria = closingSummary.criteria.filter((row) => !row.met);
  const blockers = unmetCriteria.map((row) => row.label);

  const requirementStatusCounts = countByStatus(requirements);
  const participationStatusCounts = countByStatus(activeParticipations);

  const participationRows: AdminSpvWorkspaceParticipationRow[] = activeParticipations.map((part) => {
    const partReqs = requirementsByParticipation[part.id] ?? [];
    const documentReadinessPct = part.document_readiness_pct ?? computeParticipationReadinessPct(partReqs);
    const pendingRequirements = partReqs.filter(
      (req) => req.required && !["approved", "waived"].includes(req.status),
    ).length;

    return {
      id: part.id,
      investorId: part.investor_id,
      investorName: investorNameFromParticipation(part),
      status: part.status,
      indicativeAmount: formatSpvCurrency(part.indicative_amount),
      documentReadinessPct,
      pendingRequirements,
    };
  });

  const latestRequirementUpdates: AdminSpvWorkspaceRequirementUpdate[] = [...requirements]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, REQUIREMENT_UPDATE_LIMIT)
    .map((req) => ({
      id: req.id,
      title: req.title,
      status: req.status,
      investorName: investorNameFromRequirement(req, participationById),
      category: req.category,
      updatedAt: req.updated_at,
    }));

  const packageRows: AdminSpvWorkspacePackageRow[] = packages.map((pkg) => ({
    id: pkg.id,
    packageType: pkg.package_type,
    status: pkg.status,
    label: formatPackageTypeLabel(pkg.package_type),
    updatedAt: pkg.updated_at,
  }));

  const packageComplete = packages.filter((row) =>
    COMPLETE_PACKAGE_STATUSES.includes(row.status as SpvDocumentPackageStatus),
  ).length;

  const queueItems = await loadSpvQueueItems(admin, spvId, spv.company_id);

  const complianceEvents = (complianceAll.data ?? []) as ComplianceEventRecord[];
  const openEvents = complianceEvents.filter((event) => event.status === "open" || event.status === "under_review");
  const criticalEvents = openEvents.filter((event) => event.severity === "critical");
  const highEvents = openEvents.filter((event) => event.severity === "high");
  const nextCompliance = openEvents[0];

  const checklistBySpv: Record<string, SpvChecklistItemRecord[]> = { [spvId]: checklist };
  const participationsBySpv: Record<string, SpvParticipationRecord[]> = { [spvId]: participations };
  const packagesBySpv: Record<string, SpvDocumentPackageRecord[]> = { [spvId]: packages };
  const closingReadinessBySpv = { [spvId]: closingSummary };

  return {
    spv,
    company,
    readiness: {
      operationalStatus,
      operationalLabel: formatOperationalReadinessLabel(operationalStatus),
      checklistPct,
      packagePct,
      closingPct,
      investorRequirementsPct,
      nextAction: getSpvNextAction(operationalStatus, readinessCtx),
      unmetCriteria: closingSummary.criteria,
      blockers,
    },
    participation: {
      totalCount: participations.length,
      activeCount: activeParticipations.length,
      indicativeTotal: formatSpvCurrency(totals.indicativeTotal),
      documentReadyCount: spv.investors_document_ready_count ?? 0,
      statusCounts: participationStatusCounts,
      requirementStatusCounts,
      rows: participationRows,
    },
    requirements: {
      pending: requirementStatusCounts.pending ?? 0,
      uploaded: requirementStatusCounts.uploaded ?? 0,
      underReview: requirementStatusCounts.under_review ?? 0,
      rejected: requirementStatusCounts.rejected ?? 0,
      approved: (requirementStatusCounts.approved ?? 0) + (requirementStatusCounts.waived ?? 0),
      latestUpdates: latestRequirementUpdates,
      nextAction: deriveRequirementsNextAction(requirementStatusCounts),
    },
    packages: {
      readinessPct: packagePct,
      completeCount: packageComplete,
      totalCount: packages.length,
      pendingCount: packages.filter((row) => ["not_started", "preparing"].includes(row.status)).length,
      approvedCount: packages.filter((row) => row.status === "approved").length,
      issuedCount: packages.filter((row) => row.status === "issued").length,
      rows: packageRows,
      blockers: buildPackageBlockers(packages),
    },
    closing: {
      review: closingReview
        ? {
            id: closingReview.id,
            status: closingReview.status,
            reviewed_at: closingReview.reviewed_at,
            updated_at: closingReview.updated_at,
          }
        : null,
      summary: closingSummary,
      targetOverride: Boolean(spv.closing_target_override),
      operationalCloseState: closingReview
        ? formatClosingReviewStatusLabel(closingReview.status)
        : "Not initialized",
    },
    compliance: {
      openCount: openEvents.length,
      criticalCount: criticalEvents.length,
      highCount: highEvents.length,
      recentEvents: complianceEvents.slice(0, COMPLIANCE_LIMIT),
      nextAction: nextCompliance ? `Review: ${nextCompliance.title}` : null,
    },
    timeline: timelineFeed.items,
    queueItems,
    management: {
      opportunities: [spv],
      participationsBySpv,
      checklistBySpv,
      requirementsByParticipation,
      packagesBySpv,
      closingReviewsBySpv: closingReview ? { [spvId]: closingReview as SpvClosingReviewRecord } : {},
      closingReadinessBySpv,
      companies: [{ id: company.id, name: company.name }],
    },
  };
}

export type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";
