// Data access for the founder business plan (one row per company).
// business_plans isn't in generated types yet — local raw() cast.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BusinessPlan } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapPlan(r: Row): BusinessPlan {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    sections: (r.sections as BusinessPlan["sections"]) ?? {},
    assumptions: (r.assumptions as BusinessPlan["assumptions"]) ?? {},
    projections: (r.projections as BusinessPlan["projections"]) ?? null,
    execSummary: (r.exec_summary as string | null) ?? null,
    status: (r.status as BusinessPlan["status"]) ?? "draft",
    aiAssisted: Boolean(r.ai_assisted),
    generatedAt: (r.generated_at as string | null) ?? null,
    finalizedAt: (r.finalized_at as string | null) ?? null,
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

export async function getBusinessPlan(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<BusinessPlan | null> {
  const { data, error } = await raw(supabase)
    .from("business_plans")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPlan(data as Row) : null;
}

export interface BusinessPlanPatch {
  sections?: BusinessPlan["sections"];
  assumptions?: BusinessPlan["assumptions"];
  projections?: BusinessPlan["projections"];
  execSummary?: string | null;
  status?: BusinessPlan["status"];
  aiAssisted?: boolean;
}

export async function upsertBusinessPlan(
  supabase: SupabaseClient<Database>,
  companyId: string,
  editorId: string,
  patch: BusinessPlanPatch,
): Promise<BusinessPlan> {
  const record: Record<string, unknown> = { company_id: companyId, last_edited_by: editorId };
  if (patch.sections !== undefined) record.sections = patch.sections;
  if (patch.assumptions !== undefined) record.assumptions = patch.assumptions;
  if (patch.projections !== undefined) record.projections = patch.projections;
  if (patch.execSummary !== undefined) record.exec_summary = patch.execSummary;
  if (patch.aiAssisted !== undefined) record.ai_assisted = patch.aiAssisted;
  if (patch.status !== undefined) {
    record.status = patch.status;
    if (patch.status === "finalized") record.finalized_at = new Date().toISOString();
  }

  const { data, error } = await raw(supabase)
    .from("business_plans")
    .upsert(record, { onConflict: "company_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPlan(data as Row);
}
