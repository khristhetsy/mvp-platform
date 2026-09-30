/**
 * Investor side of a Match campaign: CRM investor contacts (crm_contacts,
 * module = investor) in the shape matchInvestorToCompany scores.
 *
 * Stage comes from the investor's Odoo funding stages (profile.fundingStages,
 * the same Pre-Seed / Seed Round / Series A list founders pick from). The
 * existing contact bridge (investorProfileFromContact) feeds stage from "use of
 * funds" for the founder board; that is left as it is, and this campaign builds
 * its own investor profile so a founder's funding stage has something to meet.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvestorMatchProfile } from "@/lib/matching/investor-company-matching";
import {
  ODOO_ACTIVE_FIELD,
  ODOO_SIZE_FIELD,
  activeRatingFromOdoo,
  capitalTypesFromOdoo,
  checkSizeFromOdoo,
} from "@/lib/matching/odoo-mandate";
import { canonicalStages } from "./fields";

export type CampaignInvestor = {
  id: string;
  investorType: string | null;
  sectors: string[];
  stages: string[];
  checkBand: string | null;
  profile: InvestorMatchProfile;
};

type InvestorRow = {
  id: string;
  profile: Record<string, unknown> | null;
  overrides: Record<string, unknown> | null;
};

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x)))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function checkBandLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (max == null) return `${money(min ?? 0)}+`;
  if (!min) return `Up to ${money(max)}`;
  return `${money(min)} to ${money(max)}`;
}

/** Pure: one CRM investor row as a CampaignInvestor. Overrides win over Odoo values. */
export function campaignInvestorFromRow(row: InvestorRow): CampaignInvestor {
  const prof = row.profile ?? {};
  const extra = (prof.extra as Record<string, unknown> | undefined) ?? {};
  const ov = row.overrides ?? {};
  const sectors = list(ov.Industries).length ? list(ov.Industries) : list(prof.industries);
  const stages = canonicalStages(list(prof.fundingStages));
  const types = list(prof.investorTypes);
  const size = checkSizeFromOdoo(ov[ODOO_SIZE_FIELD] ?? extra[ODOO_SIZE_FIELD]);
  const capital = capitalTypesFromOdoo(prof.capital);
  return {
    id: row.id,
    investorType: types[0] ?? null,
    sectors,
    stages,
    checkBand: checkBandLabel(size.min, size.max),
    profile: {
      profile_id: row.id,
      investor_type: types[0] ?? null,
      check_size_min: size.min,
      check_size_max: size.max,
      preferred_sectors: sectors,
      preferred_geographies: [],
      preferred_stages: stages,
      preferred_arr_range: null,
      preferred_mrr_range: null,
      approval_status: "approved",
      capitalTypes: capital,
      activeRating: activeRatingFromOdoo(ov[ODOO_ACTIVE_FIELD] ?? extra[ODOO_ACTIVE_FIELD]),
    },
  };
}

/**
 * Every investor contact, paged (PostgREST caps a select at 1,000 rows). Loaded
 * once per matching run, not per founder. Only the small `profile` summary and
 * `overrides` are read, never the whole Odoo `raw` record.
 */
export async function loadCampaignInvestors(): Promise<CampaignInvestor[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const pageSize = 1000;
  const out: CampaignInvestor[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("crm_contacts")
      .select("id, profile, overrides")
      .eq("module", "investor")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not load investors: ${error.message}`);
    const rows = (data ?? []) as InvestorRow[];
    for (const r of rows) out.push(campaignInvestorFromRow(r));
    if (rows.length < pageSize) break;
  }
  return out;
}

/** Live investor network size for "our network of N investors". */
export async function investorNetworkCount(): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { count } = await db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("module", "investor");
  return count ?? 0;
}

/** "7,245" → "7,000+": rounded down to the thousand so the claim stays true. */
export function networkLabel(count: number): string {
  if (count >= 1000) return `${(Math.floor(count / 1000) * 1000).toLocaleString("en-US")}+`;
  return count.toLocaleString("en-US");
}
