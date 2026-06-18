import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";
import { buildDocumentChecklist, buildProfileCompletion, computeReadinessScore } from "@/lib/data/founder-readiness";
import type { DocumentRecord } from "@/lib/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MilestoneStatus = "achieved" | "not_started";

export type MilestoneResult = {
  id: string;
  category: string;
  label: string;
  description: string;
  status: MilestoneStatus;
  achievedAt: string | null;
  /** Optional: current value for numeric progress milestones */
  progress?: { current: number; target: number; unit: string };
};

export type MilestoneCategory = {
  id: string;
  label: string;
  milestones: MilestoneResult[];
};

// ─── Input ────────────────────────────────────────────────────────────────────

export type FounderMilestoneInput = {
  company: Company | null;
  documents: DocumentRecord[];
  pipelineCount: number;
  pipelineMeetingRequestedAt: string | null;
  pipelineMeetingCount: number;
  activeRoomCount: number;
  firstRoomCreatedAt: string | null;
  totalPledged: number;
  firstPledgeAt: string | null;
  firstInterestAt: string | null;
  interestCount: number;
};

// ─── Compute ──────────────────────────────────────────────────────────────────

export function computeFounderMilestones(input: FounderMilestoneInput): MilestoneCategory[] {
  const {
    company,
    documents,
    pipelineCount,
    pipelineMeetingRequestedAt,
    pipelineMeetingCount,
    activeRoomCount,
    firstRoomCreatedAt,
    totalPledged,
    firstPledgeAt,
    firstInterestAt,
    interestCount,
  } = input;

  const profileCompletion = buildProfileCompletion(company);
  const profilePct = profileCompletion.percent;
  const uploadedTypeCodes = documents.flatMap((d) => (d.document_type ? [d.document_type] : []));
  const readinessScore = computeReadinessScore(uploadedTypeCodes);
  const checklist = buildDocumentChecklist(documents);
  const uploadedCount = checklist.filter((item) => item.status !== "missing").length;

  const hasPitchDeck = uploadedTypeCodes.includes("PITCH_DECK");
  const hasFinancialModel = uploadedTypeCodes.includes("FINANCIAL_MODEL");
  const isPublished = Boolean(company?.is_published);
  const hasLogo = Boolean(company?.logo_url);

  // Helper: earliest created_at for a document type
  function docDate(typeCode: string): string | null {
    const doc = documents.find((d) => d.document_type === typeCode && d.created_at);
    return doc?.created_at ?? null;
  }

  function firstDocDate(): string | null {
    const sorted = [...documents].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
    );
    return sorted[0]?.created_at ?? null;
  }

  // ── Profile milestones ──────────────────────────────────────────────────────

  const profileMilestones: MilestoneResult[] = [
    {
      id: "profile_started",
      category: "profile",
      label: "Company profile started",
      description: "Add your company name, industry, and a brief description.",
      status: company?.company_name && company?.industry ? "achieved" : "not_started",
      achievedAt: company?.created_at ?? null,
    },
    {
      id: "profile_complete",
      category: "profile",
      label: "Company profile complete",
      description: "All key fields filled — name, industry, description, funding amount, and stage.",
      status: profilePct >= 80 ? "achieved" : "not_started",
      achievedAt: profilePct >= 80 ? (company?.updated_at ?? null) : null,
      progress: { current: profilePct, target: 100, unit: "%" },
    },
    {
      id: "logo_uploaded",
      category: "profile",
      label: "Logo uploaded",
      description: "Upload your company logo to make your profile investor-ready.",
      status: hasLogo ? "achieved" : "not_started",
      achievedAt: hasLogo ? (company?.updated_at ?? null) : null,
    },
    {
      id: "listing_published",
      category: "profile",
      label: "Listing published",
      description: "Make your company visible to investors on the platform.",
      status: isPublished ? "achieved" : "not_started",
      achievedAt: isPublished ? (company?.updated_at ?? null) : null,
    },
  ];

  // ── Document milestones ─────────────────────────────────────────────────────

  const documentMilestones: MilestoneResult[] = [
    {
      id: "first_document",
      category: "documents",
      label: "First document uploaded",
      description: "Upload any document to start building your data room.",
      status: uploadedCount > 0 ? "achieved" : "not_started",
      achievedAt: firstDocDate(),
    },
    {
      id: "pitch_deck",
      category: "documents",
      label: "Pitch deck uploaded",
      description: "Your pitch deck is the most critical document for investor conversations.",
      status: hasPitchDeck ? "achieved" : "not_started",
      achievedAt: docDate("PITCH_DECK"),
    },
    {
      id: "financial_model",
      category: "documents",
      label: "Financial model uploaded",
      description: "Investors expect a 3–5 year financial model for diligence.",
      status: hasFinancialModel ? "achieved" : "not_started",
      achievedAt: docDate("FINANCIAL_MODEL"),
    },
    {
      id: "five_documents",
      category: "documents",
      label: "5 documents uploaded",
      description: "A complete data room signals seriousness and accelerates diligence.",
      status: uploadedCount >= 5 ? "achieved" : "not_started",
      achievedAt: uploadedCount >= 5 ? firstDocDate() : null,
      progress: { current: Math.min(uploadedCount, 5), target: 5, unit: "docs" },
    },
  ];

  // ── Readiness milestones ────────────────────────────────────────────────────

  const readinessMilestones: MilestoneResult[] = [
    {
      id: "readiness_60",
      category: "readiness",
      label: "60% readiness score",
      description: "Reach 60% to be considered for initial investor conversations.",
      status: readinessScore >= 60 ? "achieved" : "not_started",
      achievedAt: readinessScore >= 60 ? (company?.updated_at ?? null) : null,
      progress: { current: Math.min(readinessScore, 60), target: 60, unit: "%" },
    },
    {
      id: "readiness_75",
      category: "readiness",
      label: "75% readiness score",
      description: "75% puts you in the investor-ready tier for institutional conversations.",
      status: readinessScore >= 75 ? "achieved" : "not_started",
      achievedAt: readinessScore >= 75 ? (company?.updated_at ?? null) : null,
      progress: { current: Math.min(readinessScore, 75), target: 75, unit: "%" },
    },
    {
      id: "readiness_90",
      category: "readiness",
      label: "90% readiness score",
      description: "Top 10% of founders on the platform — maximises your match quality.",
      status: readinessScore >= 90 ? "achieved" : "not_started",
      achievedAt: readinessScore >= 90 ? (company?.updated_at ?? null) : null,
      progress: { current: Math.min(readinessScore, 90), target: 90, unit: "%" },
    },
  ];

  // ── Investor milestones ─────────────────────────────────────────────────────

  const investorMilestones: MilestoneResult[] = [
    {
      id: "first_investor_added",
      category: "investors",
      label: "First investor added to pipeline",
      description: "Start tracking investors in your CRM to manage your fundraise.",
      status: pipelineCount > 0 ? "achieved" : "not_started",
      achievedAt: null,
    },
    {
      id: "ten_investors",
      category: "investors",
      label: "10 investors in pipeline",
      description: "A healthy pipeline has 10+ active prospects at any given time.",
      status: pipelineCount >= 10 ? "achieved" : "not_started",
      achievedAt: null,
      progress: { current: Math.min(pipelineCount, 10), target: 10, unit: "investors" },
    },
    {
      id: "twenty_five_investors",
      category: "investors",
      label: "25 investors in pipeline",
      description: "Top founders maintain 25+ prospects to ensure competitive dynamics.",
      status: pipelineCount >= 25 ? "achieved" : "not_started",
      achievedAt: null,
      progress: { current: Math.min(pipelineCount, 25), target: 25, unit: "investors" },
    },
    {
      id: "first_meeting",
      category: "investors",
      label: "First meeting requested",
      description: "An investor has requested a meeting — this is a strong signal of interest.",
      status: pipelineMeetingCount > 0 ? "achieved" : "not_started",
      achievedAt: pipelineMeetingRequestedAt,
    },
    {
      id: "first_interest",
      category: "investors",
      label: "First investor interest",
      description: "An investor on the platform has formally expressed interest in your company.",
      status: interestCount > 0 ? "achieved" : "not_started",
      achievedAt: firstInterestAt,
    },
  ];

  // ── Fundraising milestones ──────────────────────────────────────────────────

  const fundraisingMilestones: MilestoneResult[] = [
    {
      id: "first_deal_room",
      category: "fundraising",
      label: "First deal room opened",
      description: "A deal room gives investors a secure space to review your materials.",
      status: activeRoomCount > 0 || firstRoomCreatedAt != null ? "achieved" : "not_started",
      achievedAt: firstRoomCreatedAt,
    },
    {
      id: "first_pledge",
      category: "fundraising",
      label: "First pledge received",
      description: "An investor has committed capital — your raise has officially begun.",
      status: totalPledged > 0 ? "achieved" : "not_started",
      achievedAt: firstPledgeAt,
    },
    {
      id: "pledge_100k",
      category: "fundraising",
      label: "$100K pledged",
      description: "Momentum is building — use this to unlock more investor conversations.",
      status: totalPledged >= 100_000 ? "achieved" : "not_started",
      achievedAt: totalPledged >= 100_000 ? firstPledgeAt : null,
      progress: { current: Math.min(totalPledged, 100_000), target: 100_000, unit: "$" },
    },
    {
      id: "pledge_500k",
      category: "fundraising",
      label: "$500K pledged",
      description: "You're past the critical momentum threshold for most seed rounds.",
      status: totalPledged >= 500_000 ? "achieved" : "not_started",
      achievedAt: totalPledged >= 500_000 ? firstPledgeAt : null,
      progress: { current: Math.min(totalPledged, 500_000), target: 500_000, unit: "$" },
    },
    {
      id: "pledge_1m",
      category: "fundraising",
      label: "$1M pledged",
      description: "A seven-figure raise commitment signals strong investor conviction.",
      status: totalPledged >= 1_000_000 ? "achieved" : "not_started",
      achievedAt: totalPledged >= 1_000_000 ? firstPledgeAt : null,
      progress: { current: Math.min(totalPledged, 1_000_000), target: 1_000_000, unit: "$" },
    },
  ];

  return [
    { id: "profile", label: "Company profile", milestones: profileMilestones },
    { id: "documents", label: "Documents & data room", milestones: documentMilestones },
    { id: "readiness", label: "Readiness score", milestones: readinessMilestones },
    { id: "investors", label: "Investor pipeline", milestones: investorMilestones },
    { id: "fundraising", label: "Fundraising", milestones: fundraisingMilestones },
  ];
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/** Fetches all required data and returns computed milestone categories. */
export async function loadFounderMilestones(
  supabase: SupabaseClient<Database>,
  serviceSupabase: SupabaseClient<Database>,
  company: Company | null,
  profileId: string,
): Promise<MilestoneCategory[]> {
  if (!company) return computeFounderMilestones({
    company: null,
    documents: [],
    pipelineCount: 0,
    pipelineMeetingRequestedAt: null,
    pipelineMeetingCount: 0,
    activeRoomCount: 0,
    firstRoomCreatedAt: null,
    totalPledged: 0,
    firstPledgeAt: null,
    firstInterestAt: null,
    interestCount: 0,
  });

  const untypedSupabase = supabase as unknown as SupabaseClient;

  const [
    docsRes,
    pipelineRes,
    roomsRes,
    pledgeRes,
    interestRes,
  ] = await Promise.all([
    supabase.from("documents").select("id,document_type,file_name,created_at,status").eq("company_id", company.id),
    untypedSupabase
      .from("pipeline_investors")
      .select("id,meeting_requested,created_at,updated_at")
      .eq("founder_id", profileId),
    supabase
      .from("deal_rooms")
      .select("id,created_at,status")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .limit(1),
    // Pledges: via investor_interests on platform
    serviceSupabase
      .from("investor_interests")
      .select("pledge_amount, created_at")
      .eq("company_id", company.id)
      .not("pledge_amount", "is", null)
      .order("created_at", { ascending: true }),
    serviceSupabase
      .from("investor_interests")
      .select("id, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const documents = (docsRes.data ?? []) as DocumentRecord[];
  const pipeline = pipelineRes.data ?? [];
  const rooms = roomsRes.data ?? [];
  const pledges = pledgeRes.data ?? [];
  const interests = interestRes.data ?? [];

  const pipelineCount = pipeline.length;
  const meetingRows = pipeline.filter((p: { meeting_requested?: boolean }) => p.meeting_requested);
  const pipelineMeetingCount = meetingRows.length;
  const pipelineMeetingRequestedAt =
    meetingRows.length > 0
      ? (meetingRows.sort((a: { updated_at?: string }, b: { updated_at?: string }) =>
          new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime(),
        )[0]?.updated_at ?? null)
      : null;

  const firstRoomCreatedAt = rooms[0]?.created_at ?? null;

  const totalPledged = pledges.reduce((sum: number, row: { pledge_amount?: number | null }) => sum + Number(row.pledge_amount ?? 0), 0);
  const firstPledgeAt = pledges[0]?.created_at ?? null;

  const interestCount = interests.length;
  const firstInterestAt = interests[0]?.created_at ?? null;

  return computeFounderMilestones({
    company,
    documents,
    pipelineCount,
    pipelineMeetingRequestedAt: pipelineMeetingRequestedAt as string | null,
    pipelineMeetingCount,
    activeRoomCount: rooms.length,
    firstRoomCreatedAt,
    totalPledged,
    firstPledgeAt,
    firstInterestAt,
    interestCount,
  });
}
