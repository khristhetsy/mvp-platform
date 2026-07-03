// Campaign + A/B variant management (service-role only). Opener scripts are
// lexicon-guarded: forbidden terms (SPV, funding-probability language, etc.)
// are rejected at save time — the same discipline as the agent guardrail.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { findForbiddenTerms } from "@/lib/crm/lexicon";
import { GUARDRAIL_VERSION } from "@/lib/voice/guardrail";
import type { VoiceCampaign, CampaignVariant, CampaignAudience, CampaignStatus } from "@/lib/voice/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

function mapVariant(r: Record<string, unknown>): CampaignVariant {
  return {
    id: String(r.id),
    campaignId: String(r.campaign_id),
    label: String(r.label),
    openerScript: (r.opener_script as string) ?? null,
    cadenceConfig: (r.cadence_config as Record<string, unknown>) ?? {},
    trafficWeight: Number(r.traffic_weight ?? 0),
    createdAt: String(r.created_at),
  };
}

function mapCampaign(r: Record<string, unknown>, variants: CampaignVariant[]): VoiceCampaign {
  return {
    id: String(r.id),
    name: String(r.name),
    audience: r.audience as CampaignAudience,
    status: r.status as CampaignStatus,
    guardrailPromptVersion: (r.guardrail_prompt_version as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    variants,
  };
}

export async function listCampaigns(): Promise<VoiceCampaign[]> {
  const supabase = raw(createServiceRoleClient());
  const [{ data: camps }, { data: vars }] = await Promise.all([
    supabase.from("voice_campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("campaign_variants").select("*").order("created_at", { ascending: true }),
  ]);
  const byCampaign = new Map<string, CampaignVariant[]>();
  for (const v of (vars ?? []) as Record<string, unknown>[]) {
    const mv = mapVariant(v);
    const arr = byCampaign.get(mv.campaignId) ?? [];
    arr.push(mv);
    byCampaign.set(mv.campaignId, arr);
  }
  return ((camps ?? []) as Record<string, unknown>[]).map((c) => mapCampaign(c, byCampaign.get(String(c.id)) ?? []));
}

export async function createCampaign(input: { name: string; audience: CampaignAudience }): Promise<VoiceCampaign> {
  const supabase = raw(createServiceRoleClient());
  const { data, error } = await supabase
    .from("voice_campaigns")
    .insert({ name: input.name, audience: input.audience, status: "draft", guardrail_prompt_version: GUARDRAIL_VERSION })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCampaign(data as Record<string, unknown>, []);
}

export async function updateCampaign(id: string, patch: { name?: string; status?: CampaignStatus }): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.status !== undefined) update.status = patch.status;
  const { error } = await supabase.from("voice_campaigns").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Throws if the opener script contains forbidden lexicon. */
function guardScript(script: string | null | undefined): void {
  if (!script) return;
  const bad = findForbiddenTerms(script);
  if (bad.length) throw new Error(`Opener script contains forbidden terms: ${bad.join(", ")}`);
}

export async function createVariant(
  campaignId: string,
  input: { label: string; openerScript?: string | null; trafficWeight?: number; cadenceConfig?: Record<string, unknown> },
): Promise<CampaignVariant> {
  guardScript(input.openerScript);
  const supabase = raw(createServiceRoleClient());
  const { data, error } = await supabase
    .from("campaign_variants")
    .insert({
      campaign_id: campaignId,
      label: input.label,
      opener_script: input.openerScript ?? null,
      traffic_weight: input.trafficWeight ?? 100,
      cadence_config: input.cadenceConfig ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapVariant(data as Record<string, unknown>);
}

export async function updateVariant(
  id: string,
  patch: { label?: string; openerScript?: string | null; trafficWeight?: number; cadenceConfig?: Record<string, unknown> },
): Promise<void> {
  guardScript(patch.openerScript);
  const supabase = raw(createServiceRoleClient());
  const update: Record<string, unknown> = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.openerScript !== undefined) update.opener_script = patch.openerScript;
  if (patch.trafficWeight !== undefined) update.traffic_weight = patch.trafficWeight;
  if (patch.cadenceConfig !== undefined) update.cadence_config = patch.cadenceConfig;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("campaign_variants").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteVariant(id: string): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  const { error } = await supabase.from("campaign_variants").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
