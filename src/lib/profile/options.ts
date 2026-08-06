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

/** 8 — Annual EBITDA bands (also accepts free text on the profile). */
export const EBITDA_BAND_OPTIONS = [
  "Negative / pre-profit",
  "Break-even",
  "Under $250K",
  "$250K – $1M",
  "$1M – $5M",
  "$5M+",
] as const;

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
