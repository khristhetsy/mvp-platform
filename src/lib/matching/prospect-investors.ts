import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvestorMatchProfile } from "@/lib/matching/investor-company-matching";

export const PROSPECT_ID_PREFIX = "prospect:";

export function isProspectInvestorId(id: string): boolean {
  return id.startsWith(PROSPECT_ID_PREFIX);
}

export type ProspectInvestor = {
  id: string;
  name: string;
  investor_type: string | null;
  preferred_sectors: string[];
  preferred_stages: string[];
  preferred_geographies: string[];
  check_size_min: number | null;
  check_size_max: number | null;
  notes: string | null;
  source: string | null;
  created_at: string;
};

export type ProspectInvestorInput = {
  name: string;
  investor_type?: string | null;
  preferred_sectors?: string[];
  preferred_stages?: string[];
  preferred_geographies?: string[];
  check_size_min?: number | null;
  check_size_max?: number | null;
  notes?: string | null;
  source?: string | null;
};

function prospectClient(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function loadProspectInvestors(): Promise<ProspectInvestor[]> {
  try {
    const { data } = await prospectClient()
      .from("prospect_investors")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as ProspectInvestor[];
  } catch {
    return [];
  }
}

export async function createProspectInvestor(
  input: ProspectInvestorInput,
  createdBy: string | null,
): Promise<ProspectInvestor | null> {
  const { data, error } = await prospectClient()
    .from("prospect_investors")
    .insert({
      name: input.name,
      investor_type: input.investor_type ?? null,
      preferred_sectors: input.preferred_sectors ?? [],
      preferred_stages: input.preferred_stages ?? [],
      preferred_geographies: input.preferred_geographies ?? [],
      check_size_min: input.check_size_min ?? null,
      check_size_max: input.check_size_max ?? null,
      notes: input.notes ?? null,
      source: input.source ?? null,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return null;
  return data as ProspectInvestor;
}

/**
 * Prospects mapped into the matching engine's investor shape. They are scored as
 * "approved" so they rank, but their id carries the `prospect:` prefix and their
 * display name is suffixed so admin UIs can flag them. Admin-only — never fed to
 * the founder matching center.
 */
export async function loadProspectInvestorMatchProfiles(): Promise<{
  profiles: InvestorMatchProfile[];
  names: Map<string, string>;
}> {
  const prospects = await loadProspectInvestors();
  const profiles: InvestorMatchProfile[] = [];
  const names = new Map<string, string>();

  for (const p of prospects) {
    const id = `${PROSPECT_ID_PREFIX}${p.id}`;
    profiles.push({
      profile_id: id,
      investor_type: p.investor_type,
      check_size_min: p.check_size_min,
      check_size_max: p.check_size_max,
      preferred_sectors: p.preferred_sectors,
      preferred_geographies: p.preferred_geographies,
      preferred_stages: p.preferred_stages,
      approval_status: "approved",
    });
    names.set(id, `${p.name} · prospect`);
  }

  return { profiles, names };
}
