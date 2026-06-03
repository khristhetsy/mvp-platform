import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  type AdminPipelineUpdateInput,
  type InvestorPipelineStage,
  buildAdminPipelineUpdatePatch,
  filterAdminPipelineRows,
  isPipelineFollowUpDue,
  INVESTOR_PIPELINE_STAGES,
} from "@/lib/investor-crm/pipeline-logic";

export {
  INVESTOR_PIPELINE_STAGES,
  buildAdminPipelineUpdatePatch,
  filterAdminPipelineRows,
  isPipelineFollowUpDue,
  type InvestorPipelineStage,
  type AdminPipelineUpdateInput,
};

export type AdminInvestorPipelineRow = {
  id: string;
  investor_id: string;
  company_id: string;
  stage: InvestorPipelineStage;
  probability: number;
  owner_admin_id: string | null;
  owner_admin_name: string | null;
  last_activity_at: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  investor_name: string | null;
  investor_email: string | null;
  company_name: string | null;
  follow_up_due: boolean;
};

function normalizeProfile(
  raw: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null,
) {
  const profile = (Array.isArray(raw) ? raw[0] : raw) as { full_name?: string | null; email?: string | null } | null;
  return {
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? null,
  };
}

function normalizeCompanyName(
  raw: { company_name?: string | null } | { company_name?: string | null }[] | null,
) {
  const company = (Array.isArray(raw) ? raw[0] : raw) as { company_name?: string | null } | null;
  return company?.company_name ?? null;
}

export async function listAdminInvestorPipeline(
  supabase: SupabaseClient<Database>,
  options: { limit?: number; companyId?: string; investorId?: string } = {},
): Promise<AdminInvestorPipelineRow[]> {
  const limit = options.limit ?? 60;
  let query = supabase
    .from("investor_pipeline")
    .select(
      `
      id,
      investor_id,
      company_id,
      stage,
      probability,
      owner_admin_id,
      last_activity_at,
      last_contacted_at,
      next_follow_up_at,
      notes,
      profiles:investor_id ( full_name, email ),
      companies:company_id ( company_name ),
      owner:owner_admin_id ( full_name, email )
    `,
    )
    .order("last_activity_at", { ascending: false })
    .limit(limit);

  if (options.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options.investorId) {
    query = query.eq("investor_id", options.investorId);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return [];
  }

  const now = new Date();

  type PipelineRow = {
    id: string;
    investor_id: string;
    company_id: string;
    stage: string;
    probability: number;
    owner_admin_id: string | null;
    last_activity_at: string;
    last_contacted_at: string | null;
    next_follow_up_at: string | null;
    notes: string | null;
    profiles: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
    companies: { company_name?: string | null } | { company_name?: string | null }[] | null;
    owner: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  };

  return (data as PipelineRow[]).map((row) => {
    const investor = normalizeProfile(row.profiles);
    const owner = normalizeProfile(row.owner);

    return {
      id: row.id,
      investor_id: row.investor_id,
      company_id: row.company_id,
      stage: row.stage as InvestorPipelineStage,
      probability: row.probability,
      owner_admin_id: row.owner_admin_id,
      owner_admin_name: owner.full_name ?? owner.email,
      last_activity_at: row.last_activity_at,
      last_contacted_at: row.last_contacted_at,
      next_follow_up_at: row.next_follow_up_at,
      notes: row.notes,
      investor_name: investor.full_name,
      investor_email: investor.email,
      company_name: normalizeCompanyName(row.companies),
      follow_up_due: isPipelineFollowUpDue(row.next_follow_up_at, now),
    };
  });
}

export async function updateAdminInvestorPipeline(
  supabase: SupabaseClient<Database>,
  pipelineId: string,
  input: AdminPipelineUpdateInput,
  options: { defaultOwnerAdminId?: string } = {},
) {
  const patch = buildAdminPipelineUpdatePatch(input);

  if (
    !patch.stage &&
    patch.probability === undefined &&
    patch.notes === undefined &&
    patch.next_follow_up_at === undefined &&
    patch.last_contacted_at === undefined &&
    patch.owner_admin_id === undefined
  ) {
    return { error: { message: "No pipeline fields to update." } };
  }

  if (patch.owner_admin_id === undefined && options.defaultOwnerAdminId && input.markContacted === true) {
    patch.owner_admin_id = options.defaultOwnerAdminId;
  }

  const { data, error } = await supabase
    .from("investor_pipeline")
    .update(patch)
    .eq("id", pipelineId)
    .select("id, investor_id, company_id, stage")
    .single();

  if (error) {
    return { error };
  }

  return { data };
}
