import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import type { Database } from "@/lib/supabase/types";

export type ActivationMilestone = {
  key: string;
  label: string;
  achieved: boolean;
  achievedAt: string | null;
};

export type FounderActivationRow = {
  profileId: string;
  name: string;
  email: string | null;
  companyId: string | null;
  companyName: string | null;
  signedUpAt: string;
  onboardingPercent: number;
  milestones: ActivationMilestone[];
  completedCount: number;
  totalMilestones: number;
};

export type InvestorActivationRow = {
  profileId: string;
  investorProfileId: string | null;
  name: string;
  email: string | null;
  approvalStatus: string;
  signedUpAt: string;
  approvedAt: string | null;
  milestones: ActivationMilestone[];
  completedCount: number;
  totalMilestones: number;
};

function milestone(key: string, label: string, achievedAt: string | null): ActivationMilestone {
  return { key, label, achieved: Boolean(achievedAt), achievedAt };
}

export async function loadFounderActivationRows(
  admin: SupabaseClient<Database>,
  limit = 50,
): Promise<FounderActivationRow[]> {
  const { data: founders } = await admin
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "founder")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!founders?.length) return [];

  const founderIds = founders.map((f) => f.id);
  const { data: memberships } = await admin
    .from("company_members")
    .select("user_id, company_id, companies(id, company_name, onboarding_step_state, review_status, is_published)")
    .in("user_id", founderIds);

  const companyByFounder = new Map<
    string,
    {
      id: string;
      company_name: string;
      onboarding_step_state: unknown;
      review_status: string | null;
      is_published: boolean | null;
    }
  >();
  for (const row of memberships ?? []) {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    if (company && row.user_id) companyByFounder.set(row.user_id, company);
  }

  const companyIds = [...new Set([...companyByFounder.values()].map((c) => c.id))];

  const [documentsRes, interestsRes, introsRes, lessonProgressRes, dealRoomsRes, diligenceRes] =
    await Promise.all([
      companyIds.length
        ? admin.from("documents").select("company_id, created_at").in("company_id", companyIds).order("created_at")
        : Promise.resolve({ data: [] as { company_id: string; created_at: string }[] }),
      companyIds.length
        ? admin.from("investor_interests").select("company_id, created_at").in("company_id", companyIds).order("created_at")
        : Promise.resolve({ data: [] as { company_id: string; created_at: string }[] }),
      companyIds.length
        ? admin.from("intro_requests").select("company_id, created_at").in("company_id", companyIds).order("created_at")
        : Promise.resolve({ data: [] as { company_id: string; created_at: string }[] }),
      admin
        .from("founder_lesson_progress")
        .select("founder_id, completed_at")
        .in("founder_id", founderIds)
        .not("completed_at", "is", null)
        .order("completed_at"),
      founderIds.length
        ? admin.from("deal_rooms").select("id, founder_id").in("founder_id", founderIds)
        : Promise.resolve({ data: [] as { id: string; founder_id: string }[] }),
      companyIds.length
        ? admin.from("diligence_reports").select("company_id, created_at").in("company_id", companyIds).order("created_at")
        : Promise.resolve({ data: [] as { company_id: string; created_at: string }[] }),
    ]);

  const roomIds = (dealRoomsRes.data ?? []).map((r) => r.id);
  const dealRoomResponsesRes2 =
    roomIds.length > 0
      ? await admin
          .from("deal_room_questions")
          .select("room_id, responded_at")
          .in("room_id", roomIds)
          .not("founder_response", "is", null)
          .order("responded_at")
      : { data: [] as { room_id: string; responded_at: string | null }[] };

  const roomFounderById = new Map((dealRoomsRes.data ?? []).map((r) => [r.id, r.founder_id]));

  const firstDocByCompany = new Map<string, string>();
  for (const doc of documentsRes.data ?? []) {
    if (!firstDocByCompany.has(doc.company_id)) firstDocByCompany.set(doc.company_id, doc.created_at);
  }

  const firstInteractionByCompany = new Map<string, string>();
  for (const row of [...(interestsRes.data ?? []), ...(introsRes.data ?? [])]) {
    if (!row.company_id) continue;
    const existing = firstInteractionByCompany.get(row.company_id);
    if (!existing || row.created_at < existing) firstInteractionByCompany.set(row.company_id, row.created_at);
  }

  const firstResponseByFounder = new Map<string, string>();
  for (const row of dealRoomResponsesRes2.data ?? []) {
    const founderId = roomFounderById.get(row.room_id);
    if (!founderId || !row.responded_at) continue;
    const existing = firstResponseByFounder.get(founderId);
    if (!existing || row.responded_at < existing) firstResponseByFounder.set(founderId, row.responded_at);
  }

  const docsByCompany = new Map<string, Database["public"]["Tables"]["documents"]["Row"][]>();
  if (companyIds.length) {
    const { data: allDocs } = await admin.from("documents").select("*").in("company_id", companyIds);
    for (const doc of allDocs ?? []) {
      const list = docsByCompany.get(doc.company_id) ?? [];
      list.push(doc);
      docsByCompany.set(doc.company_id, list);
    }
  }

  const diligenceByCompany = new Set<string>();
  for (const row of diligenceRes.data ?? []) {
    diligenceByCompany.add(row.company_id);
  }

  const firstLessonByFounder = new Map<string, string>();
  for (const row of lessonProgressRes.data ?? []) {
    if (!row.founder_id || !row.completed_at) continue;
    const existing = firstLessonByFounder.get(row.founder_id);
    if (!existing || row.completed_at < existing) firstLessonByFounder.set(row.founder_id, row.completed_at);
  }

  const rows: FounderActivationRow[] = [];

  for (const founder of founders) {
    const company = companyByFounder.get(founder.id);
    let onboardingPercent = 0;
    let onboardingCompleteAt: string | null = null;

    if (company) {
      const docs = docsByCompany.get(company.id) ?? [];
      const progress = computeFounderOnboardingProgress({
        company: {
          id: company.id,
          founder_id: founder.id,
          company_name: company.company_name,
          onboarding_step_state: company.onboarding_step_state,
          review_status: company.review_status,
          is_published: company.is_published,
        } as Database["public"]["Tables"]["companies"]["Row"],
        documents: docs,
        diligenceReportExists: diligenceByCompany.has(company.id),
        storedStepState: company.onboarding_step_state,
      });
      onboardingPercent = progress.percent;
      if (progress.isComplete) onboardingCompleteAt = progress.completedAt;
    }

    const milestones = [
      milestone("signed_up", "Signed up", founder.created_at),
      milestone("onboarding_completed", "Onboarding completed", onboardingCompleteAt),
      milestone(
        "first_document",
        "First document uploaded",
        company ? (firstDocByCompany.get(company.id) ?? null) : null,
      ),
      milestone("first_lesson", "First learning lesson", firstLessonByFounder.get(founder.id) ?? null),
      milestone(
        "first_investor_interaction",
        "First investor interaction",
        company ? (firstInteractionByCompany.get(company.id) ?? null) : null,
      ),
      milestone("first_deal_room_response", "First deal room response", firstResponseByFounder.get(founder.id) ?? null),
    ];

    rows.push({
      profileId: founder.id,
      name: founder.full_name ?? founder.email ?? "Founder",
      email: founder.email,
      companyId: company?.id ?? null,
      companyName: company?.company_name ?? null,
      signedUpAt: founder.created_at,
      onboardingPercent,
      milestones,
      completedCount: milestones.filter((m) => m.achieved).length,
      totalMilestones: milestones.length,
    });
  }

  return rows;
}

export async function loadInvestorActivationRows(
  admin: SupabaseClient<Database>,
  limit = 50,
): Promise<InvestorActivationRow[]> {
  const { data: investors } = await admin
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "investor")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!investors?.length) return [];

  const ids = investors.map((i) => i.id);
  const { data: profiles } = await admin
    .from("investor_profiles")
    .select("id, profile_id, approval_status, approved_at, submitted_at")
    .in("profile_id", ids);

  const investorProfileByUser = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

  const [savedDealsRes, interestsRes, opportunityViewsRes, dealRoomActivityRes] = await Promise.all([
    admin.from("saved_deals").select("investor_id, created_at").in("investor_id", ids).order("created_at"),
    admin.from("investor_interests").select("investor_id, created_at").in("investor_id", ids).order("created_at"),
    admin
      .from("operational_activity_events")
      .select("actor_user_id, created_at")
      .eq("event_type", "investor.opportunity_viewed")
      .in("actor_user_id", ids)
      .order("created_at"),
    admin
      .from("deal_room_questions")
      .select("asked_by_user_id, created_at")
      .in("asked_by_user_id", ids)
      .order("created_at"),
  ]);

  const firstSaveByInvestor = new Map<string, string>();
  for (const row of savedDealsRes.data ?? []) {
    if (!firstSaveByInvestor.has(row.investor_id)) firstSaveByInvestor.set(row.investor_id, row.created_at);
  }

  const firstInterestByInvestor = new Map<string, string>();
  for (const row of interestsRes.data ?? []) {
    if (!firstInterestByInvestor.has(row.investor_id)) firstInterestByInvestor.set(row.investor_id, row.created_at);
  }

  const firstWatchlistOrSave = new Map<string, string>();
  for (const [investorId, at] of firstSaveByInvestor) firstWatchlistOrSave.set(investorId, at);

  const firstOpportunityView = new Map<string, string>();
  for (const row of opportunityViewsRes.data ?? []) {
    if (!row.actor_user_id) continue;
    if (!firstOpportunityView.has(row.actor_user_id)) firstOpportunityView.set(row.actor_user_id, row.created_at);
  }

  const firstDealRoomByInvestor = new Map<string, string>();
  for (const row of dealRoomActivityRes.data ?? []) {
    if (!firstDealRoomByInvestor.has(row.asked_by_user_id)) {
      firstDealRoomByInvestor.set(row.asked_by_user_id, row.created_at);
    }
  }

  return investors.map((investor) => {
    const ip = investorProfileByUser.get(investor.id);
    const approvedAt = ip?.approval_status === "approved" ? (ip.approved_at ?? ip.submitted_at ?? null) : null;

    const milestones = [
      milestone("signed_up", "Signed up", investor.created_at),
      milestone("approved", "Staff approved", approvedAt),
      milestone("first_opportunity_view", "First opportunity viewed", firstOpportunityView.get(investor.id) ?? null),
      milestone("first_watchlist_save", "First watchlist save", firstWatchlistOrSave.get(investor.id) ?? null),
      milestone("first_interest", "First interest expressed", firstInterestByInvestor.get(investor.id) ?? null),
      milestone("first_deal_room", "First deal room interaction", firstDealRoomByInvestor.get(investor.id) ?? null),
    ];

    return {
      profileId: investor.id,
      investorProfileId: ip?.id ?? null,
      name: investor.full_name ?? investor.email ?? "Investor",
      email: investor.email,
      approvalStatus: ip?.approval_status ?? "missing",
      signedUpAt: investor.created_at,
      approvedAt,
      milestones,
      completedCount: milestones.filter((m) => m.achieved).length,
      totalMilestones: milestones.length,
    };
  });
}

export function averageActivationDays(
  rows: Array<{ signedUpAt: string; milestones: ActivationMilestone[] }>,
  finalMilestoneKey: string,
): number | null {
  const durations: number[] = [];
  for (const row of rows) {
    const final = row.milestones.find((m) => m.key === finalMilestoneKey);
    if (!final?.achievedAt) continue;
    const ms = new Date(final.achievedAt).getTime() - new Date(row.signedUpAt).getTime();
    if (ms >= 0) durations.push(ms / (1000 * 60 * 60 * 24));
  }
  if (!durations.length) return null;
  return Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
}
