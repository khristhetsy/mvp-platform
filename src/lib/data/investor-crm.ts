import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type InvestorCrmActivityType =
  | "saved_deal"
  | "expressed_interest"
  | "requested_intro"
  | "follow_up_requested";

export type InvestorPipelineStage = "interested" | "meeting_requested" | "follow_up";

const ACTIVITY_PIPELINE_STAGE: Record<InvestorCrmActivityType, InvestorPipelineStage> = {
  saved_deal: "interested",
  expressed_interest: "interested",
  requested_intro: "meeting_requested",
  follow_up_requested: "follow_up",
};

const PIPELINE_ACTIVITY_TYPES = new Set<InvestorCrmActivityType>([
  "saved_deal",
  "expressed_interest",
  "requested_intro",
  "follow_up_requested",
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
