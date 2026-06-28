import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { countVerifiedPriorDeals } from "@/lib/investor/prior-deals";
import { computePartnerScore } from "./scoring";
import type { PartnerScore, PartnerScoreInputs } from "./types";

// NOTE (Phase 1): these queries are written against the confirmed schema but
// have not been run end-to-end. This loader powers the admin-only validation
// view precisely so the numbers can be checked against real data before any
// founder/investor-facing surface is built. Adjust queries here as needed.

const GHOST_WINDOW_DAYS = 14;

function monthsBetween(iso: string | null, now: number): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now - then) / (1000 * 60 * 60 * 24 * 30));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function loadPartnerScore(
  supabase: SupabaseClient<Database>,
  investorId: string,
  now: number = Date.now(),
): Promise<PartnerScore> {
  // 1. Interests (+ pledges) and the companies backed.
  type InterestRow = {
    company_id: string | null;
    pledge_amount: number | null;
    created_at: string | null;
  };
  const interestsRes = await supabase
    .from("investor_interests")
    .select("company_id, pledge_amount, created_at")
    .eq("investor_id", investorId);
  const interests = ((interestsRes as { data: InterestRow[] | null }).data ?? []);

  const backedCompanyIds = Array.from(
    new Set(interests.map((i) => i.company_id).filter((id): id is string => Boolean(id))),
  );
  const pledges = interests.filter((i) => (i.pledge_amount ?? 0) > 0);

  // 2. Deal rooms opened by this investor.
  type DealRoomRow = { company_id: string | null };
  const dealRoomsRes = await supabase
    .from("deal_rooms")
    .select("company_id")
    .eq("investor_user_id", investorId);
  const dealRooms = ((dealRoomsRes as { data: DealRoomRow[] | null }).data ?? []);
  const dealRoomCompanyIds = new Set(
    dealRooms.map((d) => d.company_id).filter((id): id is string => Boolean(id)),
  );

  // 2b. SPV participations — pledge follow-through (commit -> complete) + closings.
  type ParticipationRow = { status: string | null };
  const participationsRes = await supabase
    .from("spv_participations")
    .select("status")
    .eq("investor_id", investorId);
  const participations = ((participationsRes as { data: ParticipationRow[] | null }).data ?? []);
  const COMMITTED = new Set(["soft_committed", "documents_pending", "completed"]);
  const committedParticipations = participations.filter((p) => COMMITTED.has(p.status ?? "")).length;
  const completedParticipations = participations.filter((p) => p.status === "completed").length;

  // 3. Message threads + messages (responsiveness + recency).
  type ThreadRow = { id: string; founder_id: string; company_id: string | null };
  const threadsRes = await supabase
    .from("message_threads")
    .select("id, founder_id, company_id")
    .eq("investor_id", investorId);
  const threads = ((threadsRes as { data: ThreadRow[] | null }).data ?? []);

  type MessageRow = { thread_id: string; sender_id: string; created_at: string };
  let messages: MessageRow[] = [];
  if (threads.length > 0) {
    const msgRes = await supabase
      .from("thread_messages")
      .select("thread_id, sender_id, created_at")
      .in(
        "thread_id",
        threads.map((t) => t.id),
      )
      .order("created_at", { ascending: true });
    messages = ((msgRes as { data: MessageRow[] | null }).data ?? []);
  }

  let founderThreads = 0;
  let repliedThreads = 0;
  const responseHours: number[] = [];
  let lastInvestorMessageAt = 0;

  for (const thread of threads) {
    const tMsgs = messages.filter((m) => m.thread_id === thread.id);
    const firstFounderMsg = tMsgs.find((m) => m.sender_id === thread.founder_id);
    if (!firstFounderMsg) continue;
    founderThreads += 1;
    const founderTime = new Date(firstFounderMsg.created_at).getTime();
    const firstInvestorReply = tMsgs.find(
      (m) => m.sender_id === investorId && new Date(m.created_at).getTime() >= founderTime,
    );
    if (firstInvestorReply) {
      repliedThreads += 1;
      responseHours.push(
        (new Date(firstInvestorReply.created_at).getTime() - founderTime) / (1000 * 60 * 60),
      );
    }
  }
  for (const m of messages) {
    if (m.sender_id === investorId) {
      lastInvestorMessageAt = Math.max(lastInvestorMessageAt, new Date(m.created_at).getTime());
    }
  }

  // 4. Investor profile — credibility inputs.
  type ProfileRow = {
    id: string | null;
    accredited_status: boolean | null;
    accreditation_verified: boolean | null;
    check_size_min: number | null;
    check_size_max: number | null;
    investment_thesis: string | null;
    preferred_sectors: string[] | null;
    preferred_stages: string[] | null;
    created_at: string | null;
  };
  const profileRes = await supabase
    .from("investor_profiles")
    .select(
      "id, accredited_status, accreditation_verified, check_size_min, check_size_max, investment_thesis, preferred_sectors, preferred_stages, created_at",
    )
    .eq("profile_id", investorId)
    .maybeSingle();
  const profile = (profileRes as { data: ProfileRow | null }).data;

  const completenessParts = [
    Boolean(profile?.investment_thesis?.trim()),
    Boolean(profile?.preferred_sectors && profile.preferred_sectors.length > 0),
    Boolean(profile?.preferred_stages && profile.preferred_stages.length > 0),
    profile?.check_size_min != null && profile?.check_size_max != null,
  ];
  const profileCompleteness =
    completenessParts.filter(Boolean).length / completenessParts.length;

  // Admin-verified prior (off-platform) deals strengthen the track record.
  const verifiedPriorDeals = profile?.id ? await countVerifiedPriorDeals(profile.id) : 0;

  const min = profile?.check_size_min ?? 0;
  const max = profile?.check_size_max ?? Number.POSITIVE_INFINITY;
  const pledgesWithinRange = pledges.filter(
    (p) => (p.pledge_amount ?? 0) >= min && (p.pledge_amount ?? 0) <= max,
  ).length;

  // 5. Backed-company readiness (portfolio readiness).
  let backedReadinessAvg: number | null = null;
  if (backedCompanyIds.length > 0) {
    type DiligenceRow = { readiness_score: number | null };
    const diligenceRes = await supabase
      .from("diligence_reports")
      .select("readiness_score")
      .in("company_id", backedCompanyIds);
    const scores = ((diligenceRes as { data: DiligenceRow[] | null }).data ?? [])
      .map((r) => r.readiness_score)
      .filter((s): s is number => s != null);
    backedReadinessAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  // 6. Ghosting — interests whose company never reached a deal room or a thread.
  const engagedCompanyIds = new Set<string>([
    ...dealRoomCompanyIds,
    ...threads.map((t) => t.company_id).filter((id): id is string => Boolean(id)),
  ]);
  const ghostCutoff = now - GHOST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const ghostedCount = interests.filter((i) => {
    const old = i.created_at ? new Date(i.created_at).getTime() < ghostCutoff : true;
    return old && i.company_id != null && !engagedCompanyIds.has(i.company_id);
  }).length;

  // 7. Recency across all activity.
  const activityTimes = [
    lastInvestorMessageAt,
    ...interests.map((i) => (i.created_at ? new Date(i.created_at).getTime() : 0)),
  ].filter((t) => t > 0);
  const lastActive = activityTimes.length > 0 ? Math.max(...activityTimes) : null;
  const daysSinceLastActive =
    lastActive != null ? Math.floor((now - lastActive) / (1000 * 60 * 60 * 24)) : null;

  // sampleSize = distinct companies/founders engaged.
  const sampleSize = new Set<string>([
    ...backedCompanyIds,
    ...dealRoomCompanyIds,
    ...threads.map((t) => t.founder_id),
  ]).size;

  const inputs: PartnerScoreInputs = {
    sampleSize,
    interestsExpressed: interests.length,
    dealRoomsOpened: dealRooms.length,
    // Follow-through pledges come from SPV participations (commit -> complete).
    pledgesMade: committedParticipations,
    pledgesHonored: completedParticipations,
    ghostedCount,
    founderThreads,
    repliedThreads,
    medianResponseHours: median(responseHours),
    daysSinceLastActive,
    accredited: Boolean(profile?.accredited_status),
    accreditationVerified: Boolean(profile?.accreditation_verified),
    profileCompleteness,
    // Amount-pledges (for check-size consistency) come from marketplace interests.
    amountPledgesMade: pledges.length,
    pledgesWithinRange,
    backedReadinessAvg,
    closedDeals: completedParticipations,
    verifiedPriorDeals,
    tenureMonths: monthsBetween(profile?.created_at ?? null, now),
  };

  return computePartnerScore(inputs);
}
