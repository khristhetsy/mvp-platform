import type {
  AdminInvestorWorkspaceCompanyRelation,
  AdminInvestorWorkspaceData,
  AdminInvestorWorkspaceProfile,
  AdminInvestorWorkspaceSpvSummary,
} from "@/lib/admin/investor-workspace-types";
import type { ComplianceEventRecord } from "@/lib/compliance/types";
import { getInvestorMatchingSummaries } from "@/lib/matching/admin-matching-summaries";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import {
  getAdminQueueItems,
  type AdminQueueItem,
  type AdminQueueType,
} from "@/lib/queues/admin-queues";
import { computeParticipationReadinessPct } from "@/lib/spv/participation-display";
import { formatSpvCurrency } from "@/lib/spv/display";
import type { SpvParticipationRecord, SpvParticipationRequirementRecord } from "@/lib/spv/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const TIMELINE_LIMIT = 25;
const COMPLIANCE_LIMIT = 10;
const SPV_PARTICIPATION_LIMIT = 25;
const QUEUE_TYPES_FOR_INVESTOR: AdminQueueType[] = [
  "investor_approvals",
  "investor_documents",
  "compliance_escalations",
  "spv_blockers",
];

function deriveParticipationNextAction(
  status: string,
  documentReadinessPct: number,
  pendingRequirements: number,
): string {
  if (pendingRequirements > 0) {
    return "Review pending investor documents";
  }
  if (status === "documents_pending" || documentReadinessPct < 100) {
    return "Complete document requirements";
  }
  if (status === "soft_committed") {
    return "Advance to closing readiness";
  }
  if (status === "interested") {
    return "Confirm participation commitment";
  }
  if (status === "invited") {
    return "Await investor response";
  }
  return "Monitor participation status";
}

async function loadInvestorProfile(
  admin: ReturnType<typeof createServiceRoleClient>,
  investorId: string,
): Promise<AdminInvestorWorkspaceProfile | null> {
  const select = "*, profiles:profile_id(id, full_name, email, role, created_at)";

  const { data: byProfileId } = await admin
    .from("investor_profiles")
    .select(select)
    .eq("profile_id", investorId)
    .maybeSingle();

  if (byProfileId) {
    return byProfileId as AdminInvestorWorkspaceProfile;
  }

  const { data: byRecordId, error } = await admin
    .from("investor_profiles")
    .select(select)
    .eq("id", investorId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (byRecordId as AdminInvestorWorkspaceProfile | null) ?? null;
}

async function loadInvestorQueueItems(
  admin: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
  investorSpvIds: Set<string>,
): Promise<AdminQueueItem[]> {
  const batches = await Promise.all(
    QUEUE_TYPES_FOR_INVESTOR.map((queueType) => getAdminQueueItems(admin, queueType, { limit: 40 })),
  );

  return batches
    .flat()
    .filter((item) => {
      if (item.investor_id === profileId) return true;
      if (item.queue_type === "investor_approvals" && item.investor_id === profileId) return true;
      if (item.queue_type === "spv_blockers" && item.spv_id && investorSpvIds.has(item.spv_id)) {
        return true;
      }
      return false;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 15);
}

function buildCompanyRelations(input: {
  savedDeals: Array<{ company_id: string; companies?: { company_name?: string | null } | null }>;
  interests: Array<{ company_id: string; companies?: { company_name?: string | null } | null }>;
  intros: Array<{ company_id: string; companies?: { company_name?: string | null } | null }>;
  threads: Array<{ company_id: string; companies?: { company_name?: string | null } | null }>;
  participations: Array<{ company_id: string; companies?: { company_name?: string | null } | null }>;
}): AdminInvestorWorkspaceCompanyRelation[] {
  const map = new Map<string, AdminInvestorWorkspaceCompanyRelation>();

  function add(
    companyId: string,
    companyName: string | null | undefined,
    source: string,
  ) {
    const existing = map.get(companyId);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      return;
    }
    map.set(companyId, {
      companyId,
      companyName: companyName ?? "Unknown company",
      sources: [source],
    });
  }

  for (const row of input.savedDeals) {
    add(row.company_id, row.companies?.company_name, "saved_deal");
  }
  for (const row of input.interests) {
    add(row.company_id, row.companies?.company_name, "interest");
  }
  for (const row of input.intros) {
    add(row.company_id, row.companies?.company_name, "intro");
  }
  for (const row of input.threads) {
    add(row.company_id, row.companies?.company_name, "message");
  }
  for (const row of input.participations) {
    add(row.company_id, row.companies?.company_name, "spv");
  }

  return [...map.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));
}

async function loadSpvParticipationSummaries(
  admin: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
): Promise<AdminInvestorWorkspaceSpvSummary[]> {
  const { data: participations, error } = await admin
    .from("spv_participations")
    .select("*")
    .eq("investor_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(SPV_PARTICIPATION_LIMIT);

  if (error || !participations?.length) {
    return [];
  }

  const spvIds = [...new Set(participations.map((row) => row.spv_opportunity_id))];
  const companyIds = [...new Set(participations.map((row) => row.company_id))];

  const [{ data: spvs }, { data: companies }] = await Promise.all([
    spvIds.length
      ? admin.from("spv_opportunities").select("id, name, status, company_id").in("id", spvIds)
      : Promise.resolve({ data: [] as { id: string; name: string; status: string | null; company_id: string }[] }),
    companyIds.length
      ? admin.from("companies").select("id, company_name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ]);

  const spvMap = new Map((spvs ?? []).map((row) => [row.id, row]));
  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));

  const participationIds = participations.map((row) => row.id);
  const { data: requirements } = await admin
    .from("spv_participation_requirements")
    .select("id, spv_participation_id, status, required")
    .in("spv_participation_id", participationIds);

  const reqsByParticipation = new Map<string, SpvParticipationRequirementRecord[]>();
  for (const req of (requirements ?? []) as SpvParticipationRequirementRecord[]) {
    const list = reqsByParticipation.get(req.spv_participation_id) ?? [];
    list.push(req);
    reqsByParticipation.set(req.spv_participation_id, list);
  }

  return (participations as SpvParticipationRecord[]).map((part) => {
    const spv = spvMap.get(part.spv_opportunity_id);
    const reqs = reqsByParticipation.get(part.id) ?? [];
    const documentReadinessPct = part.document_readiness_pct ?? computeParticipationReadinessPct(reqs);
    const pendingRequirements = reqs.filter(
      (req) => req.required && !["approved", "waived"].includes(req.status),
    ).length;

    return {
      id: spv?.id ?? part.spv_opportunity_id,
      participationId: part.id,
      name: spv?.name ?? "SPV",
      companyId: part.company_id,
      companyName: companyMap.get(part.company_id) ?? "Unknown company",
      status: part.status,
      indicativeAmount: formatSpvCurrency(part.indicative_amount),
      documentReadinessPct,
      pendingRequirements,
      nextAction: deriveParticipationNextAction(part.status, documentReadinessPct, pendingRequirements),
    };
  });
}

export async function getAdminInvestorWorkspace(investorId: string): Promise<AdminInvestorWorkspaceData | null> {
  const admin = createServiceRoleClient();
  const investor = await loadInvestorProfile(admin, investorId);

  if (!investor) {
    return null;
  }

  const profileId = investor.profile_id;

  const [
    matchingSummaries,
    savedDealsResult,
    interestsResult,
    introsResult,
    threadsResult,
    meetingsResult,
    interestsAmounts,
    timelineFeed,
    complianceAll,
    spvParticipations,
  ] = await Promise.all([
    getInvestorMatchingSummaries([profileId]),
    admin.from("saved_deals").select("company_id").eq("investor_id", profileId).limit(100),
    admin.from("investor_interests").select("company_id").eq("investor_id", profileId).limit(100),
    admin.from("intro_requests").select("company_id").eq("investor_id", profileId).limit(100),
    admin.from("message_threads").select("company_id").eq("investor_id", profileId).limit(100),
    admin
      .from("thread_meetings")
      .select("id", { count: "exact", head: true })
      .eq("investor_id", profileId)
      .eq("status", "scheduled"),
    admin
      .from("investor_interests")
      .select("pledge_amount, interest_amount")
      .eq("investor_id", profileId)
      .limit(200),
    getOperationalActivityFeed(admin, { investorId: profileId, limit: TIMELINE_LIMIT }),
    admin
      .from("compliance_events")
      .select("*")
      .eq("investor_id", profileId)
      .order("created_at", { ascending: false })
      .limit(COMPLIANCE_LIMIT),
    loadSpvParticipationSummaries(admin, profileId),
  ]);

  const investorSpvIds = new Set(spvParticipations.map((row) => row.id));
  const queueItems = await loadInvestorQueueItems(admin, profileId, investorSpvIds);

  const savedDeals = savedDealsResult.data ?? [];
  const interests = interestsResult.data ?? [];
  const intros = introsResult.data ?? [];
  const threads = threadsResult.data ?? [];

  const relatedCompanyIds = [
    ...new Set(
      [
        ...savedDeals.map((row) => row.company_id),
        ...interests.map((row) => row.company_id),
        ...intros.map((row) => row.company_id),
        ...threads.map((row) => row.company_id),
        ...spvParticipations.map((row) => row.companyId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: companyRows } = relatedCompanyIds.length
    ? await admin.from("companies").select("id, company_name").in("id", relatedCompanyIds)
    : { data: [] as { id: string; company_name: string }[] };
  const companyNameById = new Map((companyRows ?? []).map((row) => [row.id, row.company_name]));

  const companies = buildCompanyRelations({
    savedDeals: savedDeals
      .filter((row): row is { company_id: string } => Boolean(row.company_id))
      .map((row) => ({
        company_id: row.company_id,
        companies: { company_name: companyNameById.get(row.company_id) },
      })),
    interests: interests
      .filter((row): row is { company_id: string } => Boolean(row.company_id))
      .map((row) => ({
        company_id: row.company_id,
        companies: { company_name: companyNameById.get(row.company_id) },
      })),
    intros: intros
      .filter((row): row is { company_id: string } => Boolean(row.company_id))
      .map((row) => ({
        company_id: row.company_id,
        companies: { company_name: companyNameById.get(row.company_id) },
      })),
    threads: threads
      .filter((row): row is { company_id: string } => Boolean(row.company_id))
      .map((row) => ({
        company_id: row.company_id,
        companies: { company_name: companyNameById.get(row.company_id) },
      })),
    participations: spvParticipations.map((row) => ({
      company_id: row.companyId,
      companies: { company_name: row.companyName },
    })),
  });

  let pledgeTotal = 0;
  let interestAmountTotal = 0;
  for (const row of interestsAmounts.data ?? []) {
    pledgeTotal += Number(row.pledge_amount) || 0;
    interestAmountTotal += Number(row.interest_amount) || 0;
  }

  const complianceEvents = (complianceAll.data ?? []) as ComplianceEventRecord[];
  const openEvents = complianceEvents.filter((event) => event.status === "open" || event.status === "under_review");
  const criticalEvents = openEvents.filter((event) => event.severity === "critical");
  const highEvents = openEvents.filter((event) => event.severity === "high");
  const nextCompliance = openEvents[0];

  return {
    investor: {
      ...investor,
      matchingSummary: matchingSummaries.get(profileId),
    },
    profileId,
    engagement: {
      savedDeals: savedDeals.length,
      interests: interests.length,
      introRequests: intros.length,
      messageThreads: threads.length,
      meetingsScheduled: meetingsResult.count ?? 0,
      pledgeTotal,
      interestAmountTotal,
    },
    companies,
    spvParticipations,
    compliance: {
      openCount: openEvents.length,
      criticalCount: criticalEvents.length,
      highCount: highEvents.length,
      recentEvents: complianceEvents.slice(0, COMPLIANCE_LIMIT),
      nextAction: nextCompliance ? `Review: ${nextCompliance.title}` : null,
      adminFeedback: investor.admin_feedback,
    },
    timeline: timelineFeed.items,
    queueItems,
  };
}

export type {
  AdminInvestorWorkspaceData,
  AdminInvestorWorkspaceSpvSummary,
  AdminInvestorWorkspaceCompanyRelation,
} from "@/lib/admin/investor-workspace-types";
