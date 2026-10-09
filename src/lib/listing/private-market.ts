/**
 * The investor Private Market listing of diligence complete companies.
 *
 * A company is listed once its four listing checks pass (listing_completed_at
 * set by markListingCompleteIfReady) and the founder opted in. Any CRR
 * qualifies: investors filter by CRR, sector and stage and decide. Investors
 * see the listing summary only, never documents.
 *
 * The pure helpers (filtering, facets, the free founder intro rule) are kept
 * separate from the loaders so they can be tested without a database.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { crrScoresFor } from "@/lib/crr/crr-for";
import { raisingLabel } from "@/lib/listing/deal-notices";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export type ListedCompany = {
  id: string;
  name: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  raising: string | null;
  description: string | null;
  crr: number | null;
  listedAt: string;
};

export type PrivateMarketSort = "crr" | "newest";

export type PrivateMarketFilter = {
  /** 0 or null means any CRR, including companies not yet scored. */
  minCrr?: number | null;
  sector?: string | null;
  stage?: string | null;
  sort?: PrivateMarketSort | null;
};

export const CRR_FILTER_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Any" },
  { value: 40, label: "40+" },
  { value: 60, label: "60+" },
  { value: 80, label: "80+" },
];

export const DESCRIPTION_MAX = 220;

export function truncateDescription(text: string | null | undefined, max = DESCRIPTION_MAX): string | null {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/** A company's industry field can hold several sectors ("Fintech, AI"). */
export function sectorsOf(industry: string | null | undefined): string[] {
  return String(industry ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The sector and stage choices for the filter, taken from the listed set only. */
export function listingFacets(rows: ListedCompany[]): { sectors: string[]; stages: string[] } {
  // Keyed case insensitively ("Fintech" and "fintech" are one choice); the first spelling seen wins.
  const sectors = new Map<string, string>();
  const stages = new Map<string, string>();
  for (const r of rows) {
    for (const s of sectorsOf(r.industry)) if (!sectors.has(s.toLowerCase())) sectors.set(s.toLowerCase(), s);
    const st = r.stage?.trim();
    if (st && !stages.has(st.toLowerCase())) stages.set(st.toLowerCase(), st);
  }
  const byName = (a: string, b: string) => a.localeCompare(b);
  return { sectors: [...sectors.values()].sort(byName), stages: [...stages.values()].sort(byName) };
}

/** Pure: applies the investor's filter and sort. Highest CRR first by default. */
export function applyPrivateMarketFilter(rows: ListedCompany[], filter: PrivateMarketFilter = {}): ListedCompany[] {
  const minCrr = filter.minCrr && filter.minCrr > 0 ? filter.minCrr : 0;
  const sector = filter.sector?.trim().toLowerCase() || null;
  const stage = filter.stage?.trim().toLowerCase() || null;
  const out = rows.filter((r) => {
    if (minCrr > 0 && (r.crr == null || r.crr < minCrr)) return false;
    if (sector && !sectorsOf(r.industry).some((s) => s.toLowerCase() === sector)) return false;
    if (stage && (r.stage ?? "").trim().toLowerCase() !== stage) return false;
    return true;
  });
  const newest = (a: ListedCompany, b: ListedCompany) => b.listedAt.localeCompare(a.listedAt);
  if (filter.sort === "newest") return out.sort((a, b) => newest(a, b) || a.name.localeCompare(b.name));
  // Unscored companies are listed too; they sort after every scored one.
  return out.sort((a, b) => (b.crr ?? -1) - (a.crr ?? -1) || newest(a, b) || a.name.localeCompare(b.name));
}

export type ListingRow = {
  id: string;
  company_name: string | null;
  industry: string | null;
  funding_stage: string | null;
  state: string | null;
  country: string | null;
  funding_amount: number | null;
  funding_amount_band: string | null;
  business_description: string | null;
  listing_completed_at: string;
};

/** Pure: one database row to the listing summary investors see. */
export function toListedCompany(row: ListingRow, crr: number | null): ListedCompany {
  return {
    id: row.id,
    name: row.company_name?.trim() || "Company",
    industry: row.industry?.trim() || null,
    stage: row.funding_stage?.trim() || null,
    location: [row.state, row.country].map((s) => (s ?? "").trim()).filter(Boolean).join(", ") || null,
    raising: raisingLabel(row.funding_amount, row.funding_amount_band),
    description: truncateDescription(row.business_description),
    crr,
    listedAt: row.listing_completed_at,
  };
}

const LISTING_COLUMNS =
  "id, company_name, industry, funding_stage, state, country, funding_amount, funding_amount_band, business_description, listing_completed_at";

/**
 * Every diligence complete company that opted in to the listing, with its
 * listing summary only. Read with the service role: investors have no RLS read
 * on companies they have not interacted with, and nothing beyond the summary
 * columns leaves this function.
 */
export async function listDiligenceCompleteCompanies(
  filter: PrivateMarketFilter = {},
  db: Db = createServiceRoleClient(),
): Promise<ListedCompany[]> {
  const { data, error } = await db
    .from("companies")
    .select(LISTING_COLUMNS)
    .not("listing_completed_at", "is", null)
    .not("listing_opt_in_at", "is", null)
    .or("is_sample.is.null,is_sample.eq.false")
    .order("listing_completed_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Could not load the Private Market listing: ${error.message}`);
  const rows = (data ?? []) as ListingRow[];
  const scores = await crrScoresFor(rows.map((r) => r.id));
  return applyPrivateMarketFilter(
    rows.map((r) => toListedCompany(r, scores.get(r.id) ?? null)),
    filter,
  );
}

/** True when the company is listed in the Private Market (intro requests allowed). */
export async function isPrivateMarketListed(companyId: string, db: Db = createServiceRoleClient()): Promise<boolean> {
  const { data } = await db
    .from("companies")
    .select("id, listing_completed_at, listing_opt_in_at, is_sample")
    .eq("id", companyId)
    .maybeSingle();
  return Boolean(data && data.listing_completed_at && data.listing_opt_in_at && data.is_sample !== true);
}

// ─── Investor interest on a free founder ─────────────────────────────────────

export const FREE_FOUNDER_INTRO_TTL_DAYS = 14;
export const MASKED_INTRO_MESSAGE = "A matched investor requested an introduction. Upgrade to see who and connect.";
export const MASKED_INTRO_DEEP_LINK = "/founder/investor-interest";

/** Founders on these plans see interest without the investor's identity. */
export function founderPlanHidesInvestors(plan: string | null | undefined): boolean {
  return plan === "founder_free" || plan === "founder_trial";
}

/**
 * Pure: what an intro request to this founder's company looks like. Free and
 * trial founders get a masked notice and a 14 day expiry; paid founders are
 * unchanged (no expiry, investor named).
 */
/** Same rule from a precomputed masking decision (see masksInvestorInterest). */
export function introRuleForMasked(masked: boolean, now: Date = new Date()): { masked: boolean; expiresAt: string | null } {
  return masked ? introRuleForFounderPlan("founder_free", now) : { masked: false, expiresAt: null };
}

export function introRuleForFounderPlan(
  plan: string | null | undefined,
  now: Date = new Date(),
): { masked: boolean; expiresAt: string | null } {
  if (!founderPlanHidesInvestors(plan)) return { masked: false, expiresAt: null };
  return {
    masked: true,
    expiresAt: new Date(now.getTime() + FREE_FOUNDER_INTRO_TTL_DAYS * 86_400_000).toISOString(),
  };
}

// ─── Deal notice opt in ──────────────────────────────────────────────────────

/** The Private Market card for one company, scrolled to and highlighted. */
export function privateMarketCompanyPath(companyId: string): string {
  return `/investor/opportunities?company=${encodeURIComponent(companyId)}`;
}

/**
 * Pure: where "View the full deal, free" sends the investor after the opt in
 * is recorded. A signed in investor goes straight to the company card. Anyone
 * else creates a free investor account (sign up does not read a next path, so
 * none is sent), or signs in when they asked to.
 */
export function dealOptInRedirect(input: {
  companyId: string;
  email: string | null;
  signedInRole: string | null;
  mode?: "signup" | "signin";
}): string {
  const target = privateMarketCompanyPath(input.companyId);
  if (input.signedInRole === "investor") return target;
  if (input.mode === "signin") return `/auth/sign-in?next=${encodeURIComponent(target)}`;
  const params = new URLSearchParams({ role: "investor" });
  const email = (input.email ?? "").trim();
  if (email.includes("@")) params.set("email", email);
  return `/auth/sign-up?${params.toString()}`;
}
