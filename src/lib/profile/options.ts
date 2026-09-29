/**
 * Canonical vocabulary for the founder Company Profile & Onboarding Wizard.
 *
 * These option lists are the single source of truth shared by:
 *  - the onboarding wizard (FounderConversationalOnboarding)
 *  - the Company Profile settings form (settings-form.tsx)
 *  - the investor-fit matching inputs (contact-match / load-matching-data)
 *
 * Keeping them here means the founder side and the investor-fit scoring speak
 * the exact same language, so matches line up instead of drifting apart.
 *
 * The 11 investor-fit categories, in the order they should appear on the
 * Company Profile, are described by PROFILE_CATEGORY_ORDER below.
 */

/** Revenue stage — calibrates benchmarks and stage-appropriate investors. */
export const REVENUE_STAGE_OPTIONS = [
  { id: "pre_revenue", label: "Pre-revenue", sub: "Idea, prototype, or early development" },
  { id: "early_revenue", label: "Early revenue", sub: "Up to $100K ARR" },
  { id: "growing", label: "Growing", sub: "$100K – $1M ARR" },
  { id: "scaling", label: "Scaling", sub: "$1M+ ARR" },
] as const;

/** 1 — Type of investor(s) the founder is seeking. */
export const INVESTOR_TYPE_OPTIONS = [
  "Individual angel",
  "Angel group / syndicate",
  "Family office",
  "Venture fund",
  "Corporate / strategic",
  "Other",
] as const;

/** 2 — Type(s) of capital instrument sought. */
export const CAPITAL_TYPE_OPTIONS = [
  "Equity",
  "SAFE",
  "Convertible note",
  "Venture debt",
  "Revenue-based",
] as const;

/** Active investor preference — how hands-on an investor the founder wants. */
export const INVESTOR_PREFERENCE_OPTIONS = [
  "Lead investor",
  "Follow-on / co-invest",
  "Hands-on / operator",
  "Passive",
  "No preference",
] as const;

/** 4 — Use of funds. */
export const USE_OF_FUNDS_OPTIONS = [
  "Hire team",
  "Build product",
  "Marketing & sales",
  "R&D",
  "Operations",
  "International expansion",
  "Working capital",
] as const;

/** 5 — Funding stage (round). */
export const FUNDING_STAGE_OPTIONS = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Growth",
  "Other",
] as const;

/** 9 — Operating stage of the business. */
export const OPERATING_STAGE_OPTIONS = [
  "Idea",
  "Building / MVP",
  "Pre-revenue",
  "Revenue",
  "Scaling",
] as const;

/** 11 — Business entity / incorporation type. */
export const BUSINESS_ENTITY_OPTIONS = [
  "Delaware C-Corp",
  "LLC",
  "S-Corp",
  "Public benefit corp",
  "Not yet incorporated",
] as const;

/**
 * Money bands, taken verbatim from the Odoo contact records.
 *
 * These nine labels are what investors already answered for "Investor investment
 * size?" and "Investor preferences for company with annual EBITDA range of?", and
 * what entrepreneurs answered for "Entrepreneur annual EBITDA?". Founders now pick
 * from the same list, so both sides compare like for like. Do not add or rename
 * options here: the list must stay identical to the existing data.
 */
export const MONEY_BAND_OPTIONS = [
  "Less than $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $1m",
  "$1m - $10m",
  "$10m - $50m",
  "$50m - $100m",
  "Over $100m",
] as const;

export type MoneyBand = (typeof MONEY_BAND_OPTIONS)[number];

/** Amount of capital the founder is raising, as one of the money bands. */
export const FUNDING_AMOUNT_BAND_OPTIONS = MONEY_BAND_OPTIONS;

/** 8 — Annual EBITDA (current, never projected), as one of the money bands. */
export const EBITDA_BAND_OPTIONS = MONEY_BAND_OPTIONS;

/** Lower bound (inclusive) of each band, in the same order as MONEY_BAND_OPTIONS. */
const MONEY_BAND_FLOORS = [0, 50_000, 100_000, 250_000, 500_000, 1_000_000, 10_000_000, 50_000_000, 100_000_000] as const;

/**
 * The band an exact dollar amount falls in. A value on a boundary goes to the
 * higher band ($1,000,000 is "$1m - $10m"). Anything below $50k, including zero
 * and negative EBITDA, is "Less than $50k", since the existing list has no lower
 * band. Must stay in step with public.money_band_for() in the database.
 */
export function moneyBandFor(amount: number | null | undefined): MoneyBand | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  let band: MoneyBand = MONEY_BAND_OPTIONS[0];
  for (let i = 0; i < MONEY_BAND_FLOORS.length; i += 1) {
    if (amount >= MONEY_BAND_FLOORS[i]) band = MONEY_BAND_OPTIONS[i];
  }
  return band;
}

/** True when the value is exactly one of the money band labels. */
export function isMoneyBand(value: unknown): value is MoneyBand {
  return typeof value === "string" && (MONEY_BAND_OPTIONS as readonly string[]).includes(value);
}

/**
 * The 11 investor-fit categories in the exact order they should appear on the
 * Company Profile. `column` is the backing `companies` column, `multi` marks
 * comma-separated multi-selects. Used to keep the settings form, onboarding,
 * and assistant descriptions aligned.
 */
export const PROFILE_CATEGORY_ORDER = [
  { key: "seeking_investor_types", label: "Type of investor(s)", column: "seeking_investor_types", multi: true },
  { key: "seeking_capital_types", label: "Type(s) of capital", column: "seeking_capital_types", multi: true },
  { key: "funding_amount", label: "Amount of capital", column: "funding_amount", multi: false },
  { key: "use_of_funds", label: "Use of funds", column: "use_of_funds", multi: true },
  { key: "funding_stage", label: "Funding stage", column: "funding_stage", multi: true },
  { key: "industry", label: "Type of industries", column: "industry", multi: false },
  { key: "revenue_stage", label: "Revenue stage", column: "revenue_stage", multi: false },
  { key: "annual_ebitda", label: "Annual EBITDA", column: "annual_ebitda", multi: false },
  { key: "operating_stage", label: "Operating stage", column: "operating_stage", multi: true },
  { key: "management_team", label: "Management team", column: "management_team", multi: false },
  { key: "business_entity", label: "Business entity", column: "business_entity", multi: false },
] as const;

/** Split a stored comma-separated multi-select value into its parts. */
export function splitProfileCsv(value: unknown): string[] {
  return typeof value === "string" && value.trim()
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
}

/**
 * Last-12-months revenue, as a band.
 *
 * Bands, not exact figures: this is how investors filter, and a band gets an
 * honest answer where a precise number gets a rounded guess. Distinct from
 * OPERATING_STAGE_OPTIONS, which describes the company's phase rather than its
 * revenue.
 */
export const REVENUE_SIZE_OPTIONS = [
  "Pre-revenue",
  "Under $100k",
  "$100k – $500k",
  "$500k – $1M",
  "$1M – $5M",
  "$5M+",
] as const;

/**
 * ARR and MRR as bands.
 *
 * Free text ("e.g. $240,000") never reached the matcher: the company side is
 * typed as a number, nothing parsed the text, and the two six-point factors
 * silently dropped out of every match. Bands are also how investors state their
 * own preference, so both sides now speak the same vocabulary.
 */
export const ARR_BAND_OPTIONS = [
  "None",
  "Under $100k",
  "$100k – $500k",
  "$500k – $1M",
  "$1M – $5M",
  "$5M+",
] as const;

export const MRR_BAND_OPTIONS = [
  "None",
  "Under $10k",
  "$10k – $50k",
  "$50k – $100k",
  "$100k+",
] as const;
