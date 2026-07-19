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

type CrmContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  raw: Record<string, unknown> | null;
};

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,;/|]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function odooProfile(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  const p = raw?.__profile;
  return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
}

function contactCountry(raw: Record<string, unknown> | null): string | null {
  const c = raw?.country_id;
  if (Array.isArray(c) && c.length >= 2) return String(c[1]);
  if (typeof raw?.country === "string") return raw.country;
  return null;
}

/**
 * Bulk-imports investor CRM contacts (crm_contacts where module = 'investor')
 * into prospect_investors with best-effort enrichment (sector from Odoo
 * industries, geography from country, type from investor types). Idempotent via
 * source_ref = the contact id, so re-running only adds new contacts.
 */
export async function importInvestorContactsAsProspects(
  createdBy: string | null,
): Promise<{ total: number; imported: number; skipped: number }> {
  const client = prospectClient();
  const { data } = await client
    .from("crm_contacts")
    .select("id, name, email, company, raw")
    .eq("module", "investor");

  const rows = (data ?? []) as CrmContactRow[];
  if (rows.length === 0) return { total: 0, imported: 0, skipped: 0 };

  const records = rows.map((r) => {
    const prof = odooProfile(r.raw);
    const investorTypes = asList(prof?.investorTypes);
    const industries = asList(prof?.industries);
    const country = contactCountry(r.raw);
    return {
      name: (r.name || r.email || "Unknown investor").slice(0, 200),
      investor_type: investorTypes[0] ?? null,
      preferred_sectors: industries,
      preferred_stages: [] as string[],
      preferred_geographies: country ? [country] : [],
      check_size_min: null,
      check_size_max: null,
      notes: r.company ?? null,
      source: "investor_crm",
      source_ref: r.id,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    };
  });

  let imported = 0;
  const chunkSize = 500;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { data: inserted, error } = await client
      .from("prospect_investors")
      .upsert(chunk, { onConflict: "source_ref", ignoreDuplicates: true })
      .select("id");
    if (!error) imported += (inserted ?? []).length;
  }

  return { total: records.length, imported, skipped: records.length - imported };
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
