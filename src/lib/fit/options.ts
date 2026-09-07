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
export const OP_STAGE_LABEL = "Investor preferences for type(s) of company operational stage?";
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

/** Q1 — Where are you today? → Operational stage (30%). */
export const Q1_STAGE: FitOption[] = [
  { key: "pre_revenue", label: "Pre-revenue", stored: ["Startup"] },
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
export const Q4_REVENUE: FitOption[] = [
  { key: "pre_revenue", label: "Pre-revenue", stored: ["Pre-revenue", "Less than $50k"] },
  { key: "under_1m", label: "Under $1M", stored: ["$50k - $100k", "$100k - $250k", "$250k - $500k", "$500k - $1m"] },
  { key: "1m_5m", label: "$1M – $5M", stored: ["$1m - $5m", "$1m - $10m"] },
  { key: "over_5m", label: "Over $5M", stored: ["$5m - $10m", "$10m - $50m", "$50m - $100m", "$100m+"] },
];

/** Q3 — What sector? → Industries (35%). Generated at runtime from the distinct
 *  Industries values across gated investors (never hardcoded, so a sector with no
 *  investor behind it is not offerable — build-spec §2). Founder value === stored value. */

const byKey = <T extends { key: string }>(list: T[]) => new Map(list.map((o) => [o.key, o]));
const Q1_BY_KEY = byKey(Q1_STAGE);
const Q2_BY_KEY = byKey(Q2_RAISE);
const Q4_BY_KEY = byKey(Q4_REVENUE);

export function stageStoredFor(key: string): string[] { return Q1_BY_KEY.get(key)?.stored ?? []; }
export function raiseBoundsFor(key: string): { min: number; max: number } | null {
  const o = Q2_BY_KEY.get(key);
  return o ? { min: o.min, max: o.max } : null;
}
export function revenueStoredFor(key: string): string[] { return Q4_BY_KEY.get(key)?.stored ?? []; }

/** The four answers a founder submits. */
export type FitAnswers = {
  stage: string;    // Q1 key
  raise: string;    // Q2 key
  industry: string; // Q3 stored industry value (identity)
  revenue: string;  // Q4 key
};
