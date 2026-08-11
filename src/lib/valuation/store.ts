// Valuation Studio — persistence (spec step 7). A saved valuation stores its
// input snapshot AND its method rows, so a reopened valuation reproduces exactly
// what the founder saw. Server-only; all queries go through the RLS-bound client
// so a founder only ever touches their own organization's valuations.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MethodResult, Stage } from "@/lib/valuation/methods";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export type SaveValuationInput = {
  companyName: string;
  sector: string;
  stageProfile: Stage;
  source: "profile" | "manual";
  isScenario: boolean;
  convergedLow: number;
  convergedHigh: number;
  inputs: Record<string, unknown>;
  inputProvenance: Record<string, string>;
  methods: MethodResult[];
};

export type ValuationSummary = {
  id: string;
  company_name: string;
  stage_profile: string;
  converged_low: number | null;
  converged_high: number | null;
  is_scenario: boolean;
  created_at: string;
};

export type StoredMethod = {
  method_code: string;
  low: number;
  high: number;
  basis_text: string | null;
  sort_order: number;
};

export async function createValuation(
  supabase: unknown,
  orgId: string,
  userId: string,
  data: SaveValuationInput,
): Promise<string | null> {
  const { data: v, error } = await loose(supabase)
    .from("valuations")
    .insert({
      organization_id: orgId,
      created_by: userId,
      company_name: data.companyName,
      sector: data.sector,
      stage_profile: data.stageProfile,
      source: data.source,
      is_scenario: data.isScenario,
      converged_low: data.convergedLow,
      converged_high: data.convergedHigh,
      inputs: data.inputs,
      input_provenance: data.inputProvenance,
    })
    .select("id")
    .single();
  if (error || !v) return null;

  const id = (v as { id: string }).id;
  if (data.methods.length) {
    await loose(supabase).from("valuation_methods").insert(
      data.methods.map((m, i) => ({
        valuation_id: id,
        method_code: m.code,
        low: m.low,
        high: m.high,
        basis_text: m.basis,
        sort_order: i,
      })),
    );
  }
  return id;
}

export async function listValuations(supabase: unknown, orgId: string): Promise<ValuationSummary[]> {
  const { data } = await loose(supabase)
    .from("valuations")
    .select("id, company_name, stage_profile, converged_low, converged_high, is_scenario, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data ?? []) as ValuationSummary[];
}

export async function getValuationWithMethods(
  supabase: unknown,
  id: string,
): Promise<{ valuation: Record<string, unknown>; methods: StoredMethod[] } | null> {
  const { data: v } = await loose(supabase).from("valuations").select("*").eq("id", id).maybeSingle();
  if (!v) return null;
  const { data: methods } = await loose(supabase)
    .from("valuation_methods")
    .select("method_code, low, high, basis_text, sort_order")
    .eq("valuation_id", id)
    .order("sort_order", { ascending: true });
  return { valuation: v as Record<string, unknown>, methods: (methods ?? []) as StoredMethod[] };
}
