import type {
  AdminCompanyWorkspaceData,
  AdminCompanyWorkspaceSpvSummary,
} from "@/lib/admin/company-workspace-types";
import type { AdminCompanyRow } from "@/lib/data/admin";
import { mapAdminCompaniesToCardData } from "@/lib/data/admin";
import type { ComplianceEventRecord } from "@/lib/compliance/types";
import { getRequestedPlansByProfileIds } from "@/lib/billing/requested-plan";
import { getCompanyUpdateAdminSummaries } from "@/lib/company-updates/company-updates";
import { getCompanyMatchingSummaries } from "@/lib/matching/admin-matching-summaries";
import { getLearningAdminSummaryForCompanies } from "@/lib/learning/progress";
import { computeReadinessMilestones, milestoneLabelForAdmin } from "@/lib/learning/milestones";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import {
  getAdminQueueItems,
  type AdminQueueItem,
  type AdminQueueType,
} from "@/lib/queues/admin-queues";
import { listRemediationTasksForCompany, summarizeRemediationTasks, getRemediationSummaryForCompanies } from "@/lib/remediation/tasks";
import type { RemediationTaskRecord } from "@/lib/remediation/types";
import {
  formatOperationalReadinessLabel,
  type SpvOperationalReadinessStatus,
} from "@/lib/spv/readiness";
import { formatSpvCurrency, getSpvParticipationTotals } from "@/lib/spv/display";
import type { SpvOpportunityRecord, SpvParticipationRecord } from "@/lib/spv/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";
import type { DocumentRecord } from "@/lib/supabase/types";

const TIMELINE_LIMIT = 25;
const COMPLIANCE_LIMIT = 10;
const DILIGENCE_HISTORY_LIMIT = 8;
const QUEUE_TYPES_FOR_COMPANY: AdminQueueType[] = [
  "company_reviews",
  "compliance_escalations",
  "spv_blockers",
  "investor_documents",
  "founder_remediation",
];

function parseMissingDocuments(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean).slice(0, 8);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>)
      .map((item) => String(item))
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function deriveReadinessNextAction(tasks: RemediationTaskRecord[], milestoneLabel: string): string {
  const active = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const high = active.find((task) => task.priority === "high");
  if (high?.recommended_action?.trim()) return high.recommended_action.trim();
  if (high?.title) return `Complete remediation: ${high.title}`;
  const next = active[0];
  if (next?.recommended_action?.trim()) return next.recommended_action.trim();
  if (next?.title) return `Complete remediation: ${next.title}`;
  return `Continue readiness: ${milestoneLabel}`;
}

async function loadCompanyRow(admin: ReturnType<typeof createServiceRoleClient>, companyId: string) {
  const selectWithReview = `
      id,
      company_name,
      industry,
      review_status,
      status,
      business_description,
      created_at,
      approved_at,
      is_published,
      marketplace_visible,
      published_at,
      slug,
      founder_id,
      onboarding_progress_percent,
      onboarding_completed_at,
      profiles:founder_id ( id, full_name, email, role ),
      documents ( id, document_type, file_name, file_path, status, created_at ),
      admin_reviews ( id, status, notes, feedback, requested_changes, reviewed_by, created_at )
    `;

  const { data, error } = await admin.from("companies").select(selectWithReview).eq("id", companyId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as AdminCompanyRow & {
    profiles: AdminCompanyRow["founder"];
    documents: AdminCompanyRow["documents"];
    admin_reviews: AdminCompanyRow["admin_reviews"];
  };

  return {
    id: row.id,
    company_name: row.company_name,
    industry: row.industry,
    review_status: row.review_status ?? row.status ?? "pending",
    status: row.status,
    business_description: row.business_description,
    created_at: row.created_at,
    approved_at: row.approved_at ?? null,
    is_published: row.is_published ?? false,
    marketplace_visible: row.marketplace_visible ?? false,
    published_at: row.published_at ?? null,
    slug: row.slug ?? null,
    founder_id: row.founder_id,
    onboarding_progress_percent: row.onboarding_progress_percent ?? 0,
    onboarding_completed_at: row.onboarding_completed_at ?? null,
    founder: row.profiles,
    documents: row.documents ?? [],
    admin_reviews: (row.admin_reviews ?? []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    pitchDeckUrl: null,
  } satisfies AdminCompanyRow;
}

async function loadCompanyQueueItems(
  admin: ReturnType<typeof createServiceRoleClient>,
  companyId: string,
): Promise<AdminQueueItem[]> {
  const batches = await Promise.all(
    QUEUE_TYPES_FOR_COMPANY.map((queueType) => getAdminQueueItems(admin, queueType, { limit: 30 })),
  );

  return batches
    .flat()
    .filter((item) => item.company_id === companyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 15);
}

async function loadSpvSummaries(
  admin: ReturnType<typeof createServiceRoleClient>,
  companyId: string,
): Promise<AdminCompanyWorkspaceSpvSummary[]> {
  const { data: opportunities, error } = await admin
    .from("spv_opportunities")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error || !opportunities?.length) {
    return [];
  }

  const spvIds = opportunities.map((row) => row.id);
  const { data: participations } = await admin
    .from("spv_participations")
    .select("*")
    .in("spv_opportunity_id", spvIds);

  const partsBySpv = new Map<string, SpvParticipationRecord[]>();
  for (const part of (participations ?? []) as SpvParticipationRecord[]) {
    const list = partsBySpv.get(part.spv_opportunity_id) ?? [];
    list.push(part);
    partsBySpv.set(part.spv_opportunity_id, list);
  }

  const participationIds = (participations ?? []).map((row) => row.id);
  if (participationIds.length) {
    await admin.from("spv_participation_requirements").select("id, spv_participation_id, status").in("spv_participation_id", participationIds);
  }

  return (opportunities as SpvOpportunityRecord[]).map((spv) => {
    const parts = partsBySpv.get(spv.id) ?? [];
    const activeParts = parts.filter((row) => !["declined", "canceled"].includes(row.status));
    const readiness = (spv.operational_readiness_status as SpvOperationalReadinessStatus) ?? "draft";

    return {
      id: spv.id,
      name: spv.name,
      status: spv.status ?? "draft",
      operationalReadiness: readiness,
      operationalReadinessLabel: formatOperationalReadinessLabel(readiness),
      checklistPct: spv.checklist_readiness_pct ?? 0,
      packagePct: spv.package_readiness_pct ?? 0,
      closingPct: spv.closing_readiness_pct ?? 0,
      indicativeTotal: formatSpvCurrency(getSpvParticipationTotals(activeParts).indicativeTotal),
      participantCount: activeParts.length,
      pendingRequirements: spv.investor_pending_requirements_count ?? 0,
      nextAction:
        readiness === "investors_pending" && (spv.investor_pending_requirements_count ?? 0) > 0
          ? "Review investor documents"
          : formatOperationalReadinessLabel(readiness),
    };
  });
}

export async function getAdminCompanyWorkspace(companyId: string): Promise<AdminCompanyWorkspaceData | null> {
  const admin = createServiceRoleClient();
  const companyRow = await loadCompanyRow(admin, companyId);

  if (!companyRow) {
    return null;
  }

  const founderId = companyRow.founder_id;
  const [
    remediationTasks,
    diligenceHistory,
    timelineFeed,
    queueItems,
    spvSummaries,
    savedDealsCount,
    interestsResult,
    introsCount,
    threadsCount,
    meetingsCount,
    interestsAmounts,
    complianceAll,
    subscriptionsByProfileId,
    requestedPlansByProfileId,
    remediationSummaries,
    learningSummaries,
    matchingSummaries,
    updateSummaries,
  ] = await Promise.all([
    listRemediationTasksForCompany(companyId),
    admin
      .from("diligence_reports")
      .select("id, readiness_score, created_at, missing_documents")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(DILIGENCE_HISTORY_LIMIT),
    getOperationalActivityFeed(admin, { companyId, limit: TIMELINE_LIMIT }),
    loadCompanyQueueItems(admin, companyId),
    loadSpvSummaries(admin, companyId),
    admin.from("saved_deals").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin.from("investor_interests").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin.from("intro_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin.from("message_threads").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin
      .from("thread_meetings")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "scheduled"),
    admin.from("investor_interests").select("pledge_amount, interest_amount").eq("company_id", companyId).limit(200),
    admin
      .from("compliance_events")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(COMPLIANCE_LIMIT),
    listSubscriptionsByProfileIds([founderId]),
    getRequestedPlansByProfileIds([founderId]),
    getRemediationSummaryForCompanies([companyId]),
    getLearningAdminSummaryForCompanies([companyId]),
    getCompanyMatchingSummaries([companyId]),
    getCompanyUpdateAdminSummaries([companyId]),
  ]);

  const remediationSummary = summarizeRemediationTasks(remediationTasks);
  const highPriorityOpen = remediationTasks.filter(
    (task) => task.priority === "high" && (task.status === "open" || task.status === "in_progress"),
  ).length;

  const latestReport = diligenceHistory.data?.[0] ?? null;
  const scoreHistory = (diligenceHistory.data ?? []).map((row) => ({
    readiness_score: row.readiness_score,
    created_at: row.created_at,
  }));

  const remediationByCompanyId = new Map(
    [...remediationSummaries.entries()].map(([id, summary]) => [id, { active: summary.active, total: summary.total }]),
  );

  const [companyCard] = mapAdminCompaniesToCardData(
    [companyRow],
    subscriptionsByProfileId,
    requestedPlansByProfileId,
    remediationByCompanyId,
    learningSummaries,
    matchingSummaries,
    updateSummaries,
  );

  const learning = learningSummaries.get(companyId);
  const milestones = computeReadinessMilestones({
    company: {
      id: companyRow.id,
      company_name: companyRow.company_name,
      review_status: companyRow.review_status,
      status: companyRow.status,
      business_description: companyRow.business_description,
      industry: companyRow.industry,
    } as never,
    documents: companyRow.documents as DocumentRecord[],
    onboardingPercent: companyRow.onboarding_progress_percent ?? 0,
    readinessScore: latestReport?.readiness_score ?? null,
    hasDiligenceReport: Boolean(latestReport),
    remediationActive: remediationSummary.active,
    remediationHighPriorityOpen: highPriorityOpen,
    learningPercentComplete: learning?.percentComplete ?? 0,
    learningModulesCompleted: learning?.modulesCompleted ?? 0,
  });
  const milestoneLabel = milestoneLabelForAdmin(milestones);

  const complianceEvents = (complianceAll.data ?? []) as ComplianceEventRecord[];
  const openEvents = complianceEvents.filter((event) => event.status === "open" || event.status === "under_review");
  const criticalEvents = openEvents.filter((event) => event.severity === "critical");
  const highEvents = openEvents.filter((event) => event.severity === "high");
  const nextCompliance = openEvents[0];

  let pledgeTotal = 0;
  let interestAmountTotal = 0;
  for (const row of interestsAmounts.data ?? []) {
    pledgeTotal += Number(row.pledge_amount) || 0;
    interestAmountTotal += Number(row.interest_amount) || 0;
  }

  const pitchDeckPresent = companyRow.documents.some(
    (doc) => doc.document_type?.toUpperCase() === "PITCH_DECK",
  );

  return {
    company: companyCard,
    founder: companyRow.founder,
    readiness: {
      latestScore: latestReport?.readiness_score ?? null,
      scoreHistory,
      onboardingPercent: companyRow.onboarding_progress_percent ?? 0,
      onboardingCompletedAt: companyRow.onboarding_completed_at ?? null,
      remediation: { ...remediationSummary, highPriorityOpen },
      nextAction: deriveReadinessNextAction(remediationTasks, milestoneLabel),
      milestoneLabel,
    },
    investorActivity: {
      savedDeals: savedDealsCount.count ?? 0,
      interests: interestsResult.count ?? 0,
      introRequests: introsCount.count ?? 0,
      messageThreads: threadsCount.count ?? 0,
      meetingsScheduled: meetingsCount.count ?? 0,
      pledgeTotal,
      interestAmountTotal,
    },
    spvs: spvSummaries,
    compliance: {
      openCount: openEvents.length,
      criticalCount: criticalEvents.length,
      highCount: highEvents.length,
      recentEvents: complianceEvents.slice(0, COMPLIANCE_LIMIT),
      nextAction: nextCompliance ? `Review: ${nextCompliance.title}` : null,
    },
    documents: {
      totalCount: companyRow.documents.length,
      pitchDeckPresent,
      latestDiligenceReport: latestReport,
      missingRequiredHints: parseMissingDocuments(latestReport?.missing_documents),
    },
    timeline: timelineFeed.items,
    queueItems,
  };
}

export type { AdminCompanyWorkspaceData, AdminCompanyWorkspaceSpvSummary } from "@/lib/admin/company-workspace-types";
