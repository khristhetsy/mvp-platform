// Valuation Studio — compliance constants and controls.
// One source of truth for disclaimer copy and prohibited terms. See
// valuation-compliance-appendix.md. iCapOS produces an INDICATIVE RANGE from
// founder-supplied inputs for the founder's own preparation — it does not value
// companies, price offerings, or opine on worth. Every control here enforces
// that position in code rather than relying on copy discipline.

/** The single canonical disclaimer, rendered on every valuation surface and
 *  stamped into anything exportable. Never inline this copy elsewhere. */
export const VALUATION_DISCLAIMER =
  "Indicative range generated from founder-supplied inputs for preparation purposes. " +
  "Not an appraisal, not a fairness opinion, not investment advice, and not an offer " +
  "to sell or solicit securities. iCFO Capital Global, Inc. does not set or endorse a " +
  "price for any offering.";

/** Shown above the advisor levers — uplift figures are modeled, not measured. */
export const MODELED_ESTIMATES_LINE =
  "Improvement estimates are modeled from benchmarks, not measured outcomes.";

export const SAMPLE_BADGE = "SAMPLE — NOT YOUR NUMBERS";

/**
 * Prohibited strings (appendix §2). Enforced in CI against product copy AND at
 * runtime against advisor output. Matched case-insensitively as substrings, so
 * "certified" catches "Certified Valuation". Named firms are handled separately
 * (an allowlist can't be exhaustive) — flag any capitalized firm-like token in
 * review, not here.
 */
export const BANNED_TERMS: readonly string[] = [
  "certified",
  "certification",
  "valuation report",
  "appraisal",
  "appraised value",
  "opinion of value",
  "fairness opinion",
  "409a",
  "409(a)",
  "institutional-grade",
  "institutional grade",
  "bank-grade",
  "bank grade",
  "your company is worth",
  "guaranteed",
  "will raise at",
  "investors will pay",
];

/** Returns the first banned term found in `text`, or null. Case-insensitive. */
export function findBannedTerm(text: string): string | null {
  const hay = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (hay.includes(term)) return term;
  }
  return null;
}

/** True if the text contains any prohibited term. */
export function containsBannedTerm(text: string): boolean {
  return findBannedTerm(text) !== null;
}

/** Approved feature name — never "valuation report". */
export const VALUATION_FEATURE_LABEL = "Valuation range and advisor";
