import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FounderCompanyCrmActivityRecord,
  FounderCompanyPipelineRecord,
  FounderInvestorActivityResult,
  FounderInvestorInterestRecord,
  FounderInvestorIntroRecord,
  FounderInvestorSavedRecord,
  InvestorWorkspaceData,
} from "@/lib/data/investor-interests";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import type { CompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type InvestorCrmActivityType =
  | "saved_deal"
  | "expressed_interest"
  | "requested_intro"
  | "follow_up_requested"
  | "pledge_amount_submitted"
  | "message_thread_created"
  | "message_sent"
  | "meeting_requested"
  | "meeting_accepted"
  | "meeting_declined";

export type InvestorPipelineStage = "interested" | "meeting_requested" | "follow_up";

const ACTIVITY_PIPELINE_STAGE: Record<InvestorCrmActivityType, InvestorPipelineStage> = {
  saved_deal: "interested",
  expressed_interest: "interested",
  requested_intro: "meeting_requested",
  follow_up_requested: "follow_up",
  pledge_amount_submitted: "interested",
  message_thread_created: "follow_up",
  message_sent: "follow_up",
  meeting_requested: "meeting_requested",
  meeting_accepted: "meeting_requested",
  meeting_declined: "follow_up",
};

const PIPELINE_ACTIVITY_TYPES = new Set<InvestorCrmActivityType>([
  "saved_deal",
  "expressed_interest",
  "requested_intro",
  "follow_up_requested",
  "pledge_amount_submitted",
  "message_thread_created",
  "message_sent",
  "meeting_requested",
  "meeting_accepted",
  "meeting_declined",
]);

export type RecordInvestorCrmActivityInput = {
  investorId: string;
  companyId: string;
  campaignId?: string | null;
  activityType: InvestorCrmActivityType;
  metadata?: Record<string, unknown>;
};

export async function recordInvestorCrmActivity(
  supabase: SupabaseClient<Database>,
  input: RecordInvestorCrmActivityInput,
) {
  const now = new Date().toISOString();
  const metadata = input.metadata ?? {};

  const { data: activity, error: activityError } = await supabase
    .from("investor_activity")
    .insert({
      investor_id: input.investorId,
      company_id: input.companyId,
      campaign_id: input.campaignId ?? null,
      activity_type: input.activityType,
      metadata,
    })
    .select("id")
    .single();

  if (activityError) {
    return { error: activityError };
  }

  if (!PIPELINE_ACTIVITY_TYPES.has(input.activityType)) {
    return { data: { activityId: activity.id } };
  }

  const stage = ACTIVITY_PIPELINE_STAGE[input.activityType];

  const { data: existing } = await supabase
    .from("investor_pipeline")
    .select("id, stage")
    .eq("investor_id", input.investorId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (existing?.id) {
    const { error: pipelineError } = await supabase
      .from("investor_pipeline")
      .update({
        campaign_id: input.campaignId ?? null,
        stage,
        last_activity_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (pipelineError) {
      return { error: pipelineError };
    }
  } else {
    const { error: pipelineError } = await supabase.from("investor_pipeline").insert({
      investor_id: input.investorId,
      company_id: input.companyId,
      campaign_id: input.campaignId ?? null,
      stage,
      last_activity_at: now,
      updated_at: now,
    });

    if (pipelineError) {
      return { error: pipelineError };
    }
  }

  return { data: { activityId: activity.id } };
}

export type InvestorActivityRow = {
  id: string;
  activity_type: string;
  created_at: string;
  company_name: string | null;
};

export type InvestorOwnCrmActivityResult = {
  rows: InvestorActivityRow[];
  error: string | null;
};

export async function listInvestorOwnCrmActivity(
  supabase: SupabaseClient<Database>,
  investorId: string,
  limit = 20,
): Promise<InvestorOwnCrmActivityResult> {
  // investorId must equal auth.uid() — same value API routes write to investor_id.
  const { data, error } = await supabase
    .from("investor_activity")
    .select(
      `
      id,
      activity_type,
      created_at,
      companies:company_id ( company_name )
    `,
    )
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  if (!data?.length) {
    return { rows: [], error: null };
  }

  type ActivityRow = {
    id: string;
    activity_type: string;
    created_at: string;
    companies: { company_name?: string | null } | { company_name?: string | null }[] | null;
  };

  const rows = (data as ActivityRow[]).map((row) => {
    const companyRaw = row.companies;
    const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as
      | { company_name?: string | null }
      | null
      | undefined;

    return {
      id: row.id,
      activity_type: row.activity_type,
      created_at: row.created_at,
      company_name: company?.company_name ?? null,
    };
  });

  return { rows, error: null };
}

/** Server-side CRM activity reads scoped to the authenticated auth user id. */
export async function listInvestorOwnCrmActivityForAuthenticatedInvestor(
  investorId: string,
  limit = 20,
): Promise<InvestorOwnCrmActivityResult> {
  const serviceSupabase = createServiceRoleClient();
  return listInvestorOwnCrmActivity(serviceSupabase, investorId, limit);
}

export type AdminCrmActivityRow = {
  id: string;
  activity_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  investor_name: string | null;
  investor_email: string | null;
  company_name: string | null;
  pipeline_stage: string | null;
};

export async function listRecentInvestorCrmActivity(
  supabase: SupabaseClient<Database>,
  limit = 30,
): Promise<AdminCrmActivityRow[]> {
  const { data: activities, error } = await supabase
    .from("investor_activity")
    .select(
      `
      id,
      activity_type,
      created_at,
      metadata,
      investor_id,
      company_id,
      profiles:investor_id ( full_name, email ),
      companies:company_id ( company_name )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !activities?.length) {
    return [];
  }

  type ActivityRow = {
    id: string;
    activity_type: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    investor_id: string;
    company_id: string;
    profiles: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
    companies: { company_name?: string | null } | { company_name?: string | null }[] | null;
  };

  const rows = activities as ActivityRow[];

  const investorIds = [...new Set(rows.map((row) => row.investor_id))];
  const companyIds = [...new Set(rows.map((row) => row.company_id))];

  const { data: pipelines } = await supabase
    .from("investor_pipeline")
    .select("investor_id, company_id, stage")
    .in("investor_id", investorIds)
    .in("company_id", companyIds);

  const pipelineByKey = new Map(
    (pipelines ?? []).map((row) => [`${row.investor_id}:${row.company_id}`, row.stage]),
  );

  return rows.map((row) => {
    const profileRaw = row.profiles;
    const companyRaw = row.companies;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as
      | { full_name?: string | null; email?: string | null }
      | null
      | undefined;
    const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as
      | { company_name?: string | null }
      | null
      | undefined;

    return {
      id: row.id,
      activity_type: row.activity_type,
      created_at: row.created_at,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      investor_name: profile?.full_name ?? null,
      investor_email: profile?.email ?? null,
      company_name: company?.company_name ?? null,
      pipeline_stage: pipelineByKey.get(`${row.investor_id}:${row.company_id}`) ?? null,
    };
  });
}

type FounderInvestorProfile = {
  full_name: string | null;
  email: string | null;
};

export type FounderInvestorRelationRow = {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string | null;
  actionType: "interested" | "pledged" | "indicative_interest" | "intro_requested" | "saved_deal" | "follow_up";
  actionLabel: string;
  status: string | null;
  pledgeAmount: number | null;
  pledgeCurrency: string | null;
  interestAmount: number | null;
  pipelineStage: string | null;
  lastActivityAt: string;
  notes: string | null;
};

export type FounderInvestorCrmView = {
  summary: {
    totalInterestedInvestors: number;
    totalPledgedDisplay: string;
    totalIndicativeInterestDisplay: string | null;
    introRequests: number;
    followUpsNeeded: number;
  };
  sections: {
    newInterest: FounderInvestorRelationRow[];
    pledged: FounderInvestorRelationRow[];
    introRequested: FounderInvestorRelationRow[];
    followUpNeeded: FounderInvestorRelationRow[];
    recentActivity: FounderInvestorRelationRow[];
  };
  isEmpty: boolean;
};

function normalizeFounderInvestorProfile(
  profiles: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null,
): FounderInvestorProfile {
  const profile = (Array.isArray(profiles) ? profiles[0] : profiles) as
    | { full_name?: string | null; email?: string | null }
    | null
    | undefined;

  return {
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? null,
  };
}

function founderInvestorDisplayName(profile: FounderInvestorProfile): string {
  return profile.full_name ?? profile.email ?? "Unknown investor";
}

function isFollowUpIntroMessage(message: string | null): boolean {
  if (!message) {
    return false;
  }

  return /follow[\s-]?up|capitalos platform/i.test(message);
}

const FOUNDER_ACTIVITY_LABELS: Record<FounderInvestorRelationRow["actionType"], string> = {
  interested: "Expressed interest",
  pledged: "Pledged",
  indicative_interest: "Indicative interest",
  intro_requested: "Intro requested",
  saved_deal: "Saved deal",
  follow_up: "Follow-up requested",
};

const CRM_ACTIVITY_TO_ACTION: Record<string, FounderInvestorRelationRow["actionType"]> = {
  saved_deal: "saved_deal",
  expressed_interest: "interested",
  requested_intro: "intro_requested",
  follow_up_requested: "follow_up",
  pledge_amount_submitted: "pledged",
};

function buildPipelineStageByInvestor(
  activity: FounderInvestorActivityResult,
): Map<string, string> {
  const stageByInvestor = new Map<string, string>();

  for (const row of activity.pipeline) {
    stageByInvestor.set(row.investor_id, row.stage);
  }

  for (const intro of activity.introRequests) {
    if (isFollowUpIntroMessage(intro.message)) {
      stageByInvestor.set(intro.investor_id, "follow_up");
      continue;
    }

    if (!stageByInvestor.has(intro.investor_id)) {
      stageByInvestor.set(intro.investor_id, "meeting_requested");
    }
  }

  for (const interest of activity.interests) {
    if (!stageByInvestor.has(interest.investor_id)) {
      stageByInvestor.set(interest.investor_id, "interested");
    }
  }

  for (const saved of activity.savedDeals) {
    if (!stageByInvestor.has(saved.investor_id)) {
      stageByInvestor.set(saved.investor_id, "interested");
    }
  }

  return stageByInvestor;
}

function interestActionType(interest: FounderInvestorInterestRecord): FounderInvestorRelationRow["actionType"] {
  if (interest.pledge_amount != null && Number(interest.pledge_amount) > 0) {
    return "pledged";
  }

  if (interest.interest_amount != null && Number(interest.interest_amount) > 0) {
    return "indicative_interest";
  }

  return "interested";
}

function relationRowFromInterest(
  interest: FounderInvestorInterestRecord,
  pipelineStage: string | null,
): FounderInvestorRelationRow {
  const profile = normalizeFounderInvestorProfile(interest.profiles);
  const actionType = interestActionType(interest);

  return {
    id: `interest:${interest.id}`,
    investorId: interest.investor_id,
    investorName: founderInvestorDisplayName(profile),
    investorEmail: profile.email,
    actionType,
    actionLabel: FOUNDER_ACTIVITY_LABELS[actionType],
    status: interest.status,
    pledgeAmount: interest.pledge_amount != null ? Number(interest.pledge_amount) : null,
    pledgeCurrency: interest.pledge_currency ?? null,
    interestAmount: interest.interest_amount != null ? Number(interest.interest_amount) : null,
    pipelineStage,
    lastActivityAt: interest.updated_at ?? interest.created_at,
    notes: interest.message,
  };
}

function relationRowFromIntro(
  intro: FounderInvestorIntroRecord,
  pipelineStage: string | null,
): FounderInvestorRelationRow {
  const profile = normalizeFounderInvestorProfile(intro.profiles);
  const followUp = isFollowUpIntroMessage(intro.message);
  const actionType: FounderInvestorRelationRow["actionType"] = followUp ? "follow_up" : "intro_requested";

  return {
    id: `intro:${intro.id}`,
    investorId: intro.investor_id,
    investorName: founderInvestorDisplayName(profile),
    investorEmail: profile.email,
    actionType,
    actionLabel: FOUNDER_ACTIVITY_LABELS[actionType],
    status: intro.status,
    pledgeAmount: null,
    pledgeCurrency: null,
    interestAmount: null,
    pipelineStage,
    lastActivityAt: intro.created_at,
    notes: intro.message,
  };
}

function relationRowFromSaved(
  saved: FounderInvestorSavedRecord,
  pipelineStage: string | null,
): FounderInvestorRelationRow {
  const profile = normalizeFounderInvestorProfile(saved.profiles);

  return {
    id: `saved:${saved.id}`,
    investorId: saved.investor_id,
    investorName: founderInvestorDisplayName(profile),
    investorEmail: profile.email,
    actionType: "saved_deal",
    actionLabel: FOUNDER_ACTIVITY_LABELS.saved_deal,
    status: saved.status,
    pledgeAmount: null,
    pledgeCurrency: null,
    interestAmount: null,
    pipelineStage,
    lastActivityAt: saved.updated_at ?? saved.created_at,
    notes: null,
  };
}

function relationRowFromCrmActivity(
  activity: FounderCompanyCrmActivityRecord,
  pipelineStage: string | null,
): FounderInvestorRelationRow {
  const profile = normalizeFounderInvestorProfile(activity.profiles);
  const actionType = CRM_ACTIVITY_TO_ACTION[activity.activity_type] ?? "interested";
  const metadata = activity.metadata ?? {};
  const pledgeAmount =
    typeof metadata.pledge_amount === "number"
      ? metadata.pledge_amount
      : typeof metadata.pledgeAmount === "number"
        ? metadata.pledgeAmount
        : null;
  const pledgeCurrency =
    typeof metadata.pledge_currency === "string"
      ? metadata.pledge_currency
      : typeof metadata.pledgeCurrency === "string"
        ? metadata.pledgeCurrency
        : null;
  const interestAmount =
    typeof metadata.interest_amount === "number"
      ? metadata.interest_amount
      : typeof metadata.interestAmount === "number"
        ? metadata.interestAmount
        : null;
  const notes =
    typeof metadata.message === "string"
      ? metadata.message
      : typeof metadata.note === "string"
        ? metadata.note
        : null;

  return {
    id: `activity:${activity.id}`,
    investorId: activity.investor_id,
    investorName: founderInvestorDisplayName(profile),
    investorEmail: profile.email,
    actionType,
    actionLabel: FOUNDER_ACTIVITY_LABELS[actionType],
    status: null,
    pledgeAmount,
    pledgeCurrency,
    interestAmount,
    pipelineStage,
    lastActivityAt: activity.created_at,
    notes,
  };
}

function sortByRecentActivity(rows: FounderInvestorRelationRow[]): FounderInvestorRelationRow[] {
  return [...rows].sort(
    (left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime(),
  );
}

export function buildFounderInvestorCrmView(
  activity: FounderInvestorActivityResult,
  pledgeSummary: CompanyPledgeSummary,
): FounderInvestorCrmView {
  const pipelineStageByInvestor = buildPipelineStageByInvestor(activity);

  const interestRows = activity.interests.map((interest) =>
    relationRowFromInterest(interest, pipelineStageByInvestor.get(interest.investor_id) ?? null),
  );
  const introRows = activity.introRequests.map((intro) =>
    relationRowFromIntro(intro, pipelineStageByInvestor.get(intro.investor_id) ?? null),
  );
  const savedRows = activity.savedDeals.map((saved) =>
    relationRowFromSaved(saved, pipelineStageByInvestor.get(saved.investor_id) ?? null),
  );
  const crmActivityRows = activity.crmActivity.map((row) =>
    relationRowFromCrmActivity(row, pipelineStageByInvestor.get(row.investor_id) ?? null),
  );

  const newInterest = sortByRecentActivity(
    interestRows.filter((row) => row.actionType === "interested"),
  );
  const pledged = sortByRecentActivity(
    interestRows.filter((row) => row.actionType === "pledged" || row.actionType === "indicative_interest"),
  );
  const introRequested = sortByRecentActivity(introRows.filter((row) => row.actionType === "intro_requested"));
  const followUpNeeded = sortByRecentActivity([
    ...introRows.filter((row) => row.actionType === "follow_up"),
    ...crmActivityRows.filter((row) => row.actionType === "follow_up"),
    ...interestRows.filter((row) => row.pipelineStage === "follow_up"),
  ]);

  const recentActivity = sortByRecentActivity([
    ...interestRows,
    ...introRows,
    ...savedRows,
    ...crmActivityRows,
  ]).slice(0, 30);

  const interestedInvestorIds = new Set<string>();
  for (const row of [...interestRows, ...savedRows, ...introRows, ...crmActivityRows]) {
    interestedInvestorIds.add(row.investorId);
  }

  const indicativeTotal = activity.interests.reduce((total, interest) => {
    if (interest.interest_amount == null || Number(interest.interest_amount) <= 0) {
      return total;
    }

    return total + Number(interest.interest_amount);
  }, 0);

  const isEmpty =
    activity.interests.length === 0 &&
    activity.introRequests.length === 0 &&
    activity.savedDeals.length === 0 &&
    activity.crmActivity.length === 0;

  return {
    summary: {
      totalInterestedInvestors: interestedInvestorIds.size,
      totalPledgedDisplay: formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency),
      totalIndicativeInterestDisplay:
        indicativeTotal > 0 ? formatPledgeTotal(indicativeTotal, pledgeSummary.currency) : null,
      introRequests: introRequested.length,
      followUpsNeeded: followUpNeeded.length,
    },
    sections: {
      newInterest,
      pledged,
      introRequested,
      followUpNeeded,
      recentActivity,
    },
    isEmpty,
  };
}

export type InvestorWorkspaceSummary = {
  savedCount: number;
  interestsCount: number;
  introRequestsCount: number;
  pledgeTotal: number;
  indicativeTotal: number;
  pledgeCurrency: string;
  crmActivityCount: number;
};

export function summarizeInvestorWorkspace(
  workspace: InvestorWorkspaceData,
  crmActivity: InvestorOwnCrmActivityResult,
): InvestorWorkspaceSummary {
  const pledgeCurrency =
    workspace.interests.find((row) => row.pledge_currency)?.pledge_currency ?? "USD";
  const pledgeTotal = workspace.interests.reduce((total, row) => {
    if (row.pledge_amount == null || Number(row.pledge_amount) <= 0) {
      return total;
    }

    return total + Number(row.pledge_amount);
  }, 0);
  const indicativeTotal = workspace.interests.reduce((total, row) => {
    if (row.interest_amount == null || Number(row.interest_amount) <= 0) {
      return total;
    }

    return total + Number(row.interest_amount);
  }, 0);

  return {
    savedCount: workspace.savedDeals.length,
    interestsCount: workspace.interests.length,
    introRequestsCount: workspace.introRequests.length,
    pledgeTotal,
    indicativeTotal,
    pledgeCurrency,
    crmActivityCount: crmActivity.rows.length,
  };
}
