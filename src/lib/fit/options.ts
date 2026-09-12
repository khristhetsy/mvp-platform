/**
 * /fit funnel — the four questions and their option sets, and the SINGLE place
 * that maps each founder-facing choice to the value(s) stored on investor
 * contacts. The funnel UI and the matcher both import from here, so the option
 * strings can never drift from what's matched against (build-spec §2, §12 risk).
 *
 * Investor criteria live in crm_contacts.raw.__profile:
 *   - industries          → __profile.industries               (semantic key, array)
 *   - operational stage   → __profile.extra[OP_STAGE_LABEL]    (Odoo questionnaire)
 *   - investment size     → __profile.extra[INV_SIZE_LABEL]    (bands)
 *   - annual revenue      → __profile.extra[REVENUE_LABEL]     (bands)
 * (We read the existing jsonb rather than duplicating into inv_* columns.)
 *
 * NOTE (open decision §13.2): the `stored` value lists below MUST be byte-identical
 * to the real values on contacts. Industries pass through as-is; the stage/size/
 * revenue mappings are the Odoo option spellings and should be confirmed against
 * live data before the funnel screens ship. They are isolated here so confirming
 * them is a one-file edit with no matcher changes.
 */

/** Odoo questionnaire labels the criteria live under in raw.__profile.extra. */
// The investor questionnaire stores the operating-stage preference under this key
// ("Startup" / "Prototype" / "Expand Growth" / …) — these are the values Q1_STAGE maps
// to. (It is NOT stored under the older "Investor preferences for … operational stage?"
// label, which is why stage silently never matched until this was corrected.)
export const OP_STAGE_LABEL = "Entrepreneur operating stage?";
export const INV_SIZE_LABEL = "Investor investment size?";
export const REVENUE_LABEL = "Investor preferences for the company with an annual revenue range of?";

export type FitOption = {
  /** Stable key used in the session + URL/state (never shown). */
  key: string;
  /** Founder-facing label. */
  label: string;
  /** Values as stored on investor contacts that this choice matches. Empty =
   *  needs confirmation against live data before it can match anything. */
  stored: string[];
};

/** Q1 — Where are you today? → Operational stage (30%). Stored values are the
 *  Odoo operational-stage dropdown (Startup · Prototype · Expand Growth · Small
 *  Business · Midsize Company · Large Corporation · Large Company · Other). */
export const Q1_STAGE: FitOption[] = [
  { key: "pre_revenue", label: "Pre-revenue", stored: ["Startup", "Prototype"] },
  { key: "revenue_pre_a", label: "Revenue, pre-Series A", stored: ["Expand Growth", "Small Business"] },
  { key: "series_a_plus", label: "Series A and beyond", stored: ["Midsize Company", "Large Corporation", "Large Company"] },
];

/** Q2 — How much are you raising? → Investment size (25%). Raise is a $ range;
 *  the matcher overlaps it against the investor's min/max, so these carry the
 *  numeric bounds (USD) rather than stored strings. */
export type FitRaiseOption = { key: string; label: string; min: number; max: number };
export const Q2_RAISE: FitRaiseOption[] = [
  { key: "under_1m", label: "Under $1M", min: 0, max: 1_000_000 },
  { key: "1m_10m", label: "$1M – $10M", min: 1_000_000, max: 10_000_000 },
  { key: "over_10m", label: "Over $10M", min: 10_000_000, max: Number.MAX_SAFE_INTEGER },
];

/** Q4 — What is your revenue? → Annual revenue range (10%). */
// Revenue-range values confirmed against live data (2026-09-07).
export const Q4_REVENUE: FitOption[] = [
  { key: "pre_revenue", label: "Pre-revenue", stored: ["Less than $50k"] },
  { key: "under_1m", label: "Under $1M", stored: ["$50k - $100k", "$100k - $250k", "$250k - $500k", "$500k - $1m"] },
  { key: "1m_5m", label: "$1M – $5M", stored: ["$1m - $10m"] },
  { key: "over_5m", label: "Over $5M", stored: ["$10m - $50m", "$50m - $100m", "Over $100m"] },
];

/** Q3 — What sector? → Industries (35%). Generated at runtime from the distinct
 *  Industries values across gated investors (never hardcoded, so a sector with no
 *  investor behind it is not offerable — build-spec §2). Founder value === stored value. */

/** Q5 — What type of investor are you looking for? → investorTypes (semantic key,
 *  like industries). "Open to any" (empty stored) disables the filter. */
export const Q5_INVESTOR_TYPE: FitOption[] = [
  { key: "angel", label: "Angel", stored: ["Angel", "Angel Investor"] },
  { key: "vc", label: "Venture Capital", stored: ["Venture Capital", "Venture", "VC"] },
  { key: "pe", label: "Private Equity", stored: ["Private Equity", "PE"] },
  { key: "family_office", label: "Family Office", stored: ["Family Office"] },
  { key: "corporate", label: "Corporate / Strategic", stored: ["Corporate", "Strategic", "Corporate / Strategic", "Corporate Venture"] },
  { key: "any", label: "Open to any", stored: [] },
];

/**
 * Canonical investor-type spellings — the single place anything that WRITES an investor
 * type must go through, so a stored value is always one the matcher can compare.
 *
 * Q5 matches on exact (case-insensitive) strings, so a plausible-looking value like
 * "Corporate VC" is silently dead: it is not in Q5_INVESTOR_TYPE.stored, so no founder
 * answer ever matches it. "Accelerator" is deliberately allowed through even though /fit
 * does not offer it — it is real information for staff, it just doesn't score.
 * Ordered most-specific first: "corporate venture" must win before plain "venture".
 */
const TYPE_CANON: Array<{ re: RegExp; type: string }> = [
  { re: /\bfamily office\b/i, type: "Family Office" },
  { re: /\bcorporate\b|\bstrategic\b|\bcvc\b/i, type: "Corporate Venture" },
  { re: /\bprivate equity\b|^\s*pe\s*$/i, type: "Private Equity" },
  { re: /\b(accelerator|incubator)\b/i, type: "Accelerator" },
  { re: /\bangel\b/i, type: "Angel" },       // \b so "Los Angeles" doesn't match
  { re: /\bventure(s| capital)?\b|^\s*vc\s*$/i, type: "VC" },
];

/** Map a free-form investor type onto a canonical spelling. Null when unrecognised. */
export function canonicalInvestorType(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  if (!s) return null;
  return TYPE_CANON.find((r) => r.re.test(s))?.type ?? null;
}

/** The canonical values, for prompts and pickers. */
export const INVESTOR_TYPE_VOCAB: string[] = [...new Set(TYPE_CANON.map((r) => r.type))];

const byKey = <T extends { key: string }>(list: T[]) => new Map(list.map((o) => [o.key, o]));
const Q1_BY_KEY = byKey(Q1_STAGE);
const Q2_BY_KEY = byKey(Q2_RAISE);
const Q4_BY_KEY = byKey(Q4_REVENUE);
const Q5_BY_KEY = byKey(Q5_INVESTOR_TYPE);

// Multi-select: answers are arrays; each helper unions the stored values / bounds.
export function stageStoredFor(keys: string[]): string[] { return keys.flatMap((k) => Q1_BY_KEY.get(k)?.stored ?? []); }
export function raiseBoundsFor(keys: string[]): { min: number; max: number } | null {
  const bounds = keys.map((k) => Q2_BY_KEY.get(k)).filter((o): o is FitRaiseOption => !!o);
  if (bounds.length === 0) return null;
  return { min: Math.min(...bounds.map((b) => b.min)), max: Math.max(...bounds.map((b) => b.max)) };
}
export function revenueStoredFor(keys: string[]): string[] { return keys.flatMap((k) => Q4_BY_KEY.get(k)?.stored ?? []); }
export function investorTypeStoredFor(keys: string[]): string[] { return keys.flatMap((k) => Q5_BY_KEY.get(k)?.stored ?? []); }
/** "Open to any" / nothing selected ⇒ no investor-type constraint. */
export function investorTypeIsAny(keys: string[]): boolean { return keys.length === 0 || keys.includes("any"); }

/** The five answers a founder submits (each multi-select). */
export type FitAnswers = {
  stage: string[];        // Q1 keys
  raise: string[];        // Q2 keys
  industry: string[];     // Q3 stored industry values (identity)
  revenue: string[];      // Q4 keys
  investorType: string[]; // Q5 keys
};
