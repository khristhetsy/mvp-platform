// Lifecycle funnel counts for the three hub dashboards. Each returns an ordered
// stage list with a live count and a link to the filtered list view. Read-only,
// service-role. Stages are sourced from the canonical pipeline definitions, never
// hardcoded here (sales_stages rows, crm_contacts.lead_status, investor_pipeline.stage).
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/prospects/lead-status";
import { INVESTOR_PIPELINE_STAGES, INVESTOR_PIPELINE_STAGE_LABEL } from "@/lib/investor-crm/pipeline-logic";
import { listPipelines, listBoardOpportunities } from "@/lib/sales/pipelines";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface LifecycleStage { key: string; label: string; count: number; href?: string }

/** Sales: open opportunities grouped by the default pipeline's stages. */
export async function salesLifecycle(): Promise<LifecycleStage[]> {
  const [pipelines, opps] = await Promise.all([listPipelines(), listBoardOpportunities()]);
  const def = pipelines.find((p) => p.is_default) ?? pipelines[0];
  if (!def) return [];
  return def.stages
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      key: s.id,
      label: s.name,
      count: opps.filter((o) => o.stage_id === s.id).length,
      href: `/admin/sales/pipeline?stage=${s.id}`,
    }));
}

/** Marketing: CRM contacts grouped by lead_status lifecycle (excludes terminal disqualified). */
export async function marketingLifecycle(): Promise<LifecycleStage[]> {
  const stages = LEAD_STATUSES.filter((s) => s !== "disqualified") as LeadStatus[];
  return Promise.all(stages.map(async (s) => {
    const { count } = await db().from("crm_contacts").select("id", { count: "exact", head: true }).eq("lead_status", s);
    return { key: s, label: LEAD_STATUS_LABEL[s], count: count ?? 0, href: `/admin/marketing/contacts?lead_status=${s}` };
  }));
}

/** Investor Relations: investor_pipeline relationships grouped by the 5-stage funnel. */
export async function investorLifecycle(): Promise<LifecycleStage[]> {
  return Promise.all(INVESTOR_PIPELINE_STAGES.map(async (s) => {
    const { count } = await db().from("investor_pipeline").select("id", { count: "exact", head: true }).eq("stage", s);
    return { key: s, label: INVESTOR_PIPELINE_STAGE_LABEL[s], count: count ?? 0, href: `/admin/playbook?stage=${s}` };
  }));
}

/** Founder journey: founder profiles grouped by their journey_stage (the 4 founder
 *  stages surfaced in the founder side nav). */
const FOUNDER_JOURNEY: Array<{ key: string; label: string }> = [
  { key: "initialize", label: "Onboarding" },
  { key: "qualify", label: "Verification" },
  { key: "deploy", label: "Deals access" },
  { key: "optimize", label: "Manage deals" },
];
export async function founderLifecycle(): Promise<LifecycleStage[]> {
  return Promise.all(FOUNDER_JOURNEY.map(async (s) => {
    const { count } = await db().from("profiles").select("id", { count: "exact", head: true }).eq("role", "founder").eq("journey_stage", s.key);
    return { key: s.key, label: s.label, count: count ?? 0, href: `/admin/crm/founders?stage=${s.key}` };
  }));
}
