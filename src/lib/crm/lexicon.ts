// Locked terminology for the Admin CRM console. All operator-facing copy in
// components/crm/** pulls from here so compliance-sensitive language lives in
// one place. A unit test (lexicon.test.ts) fails the build if any forbidden
// term appears in components/crm/**.

/** Approved, compliance-safe vocabulary. */
export const CRM_LEXICON = {
  indicatedInterest: "indicated interest",
  engagementTraction: "engagement traction",
  privateMarket: "Private Market",
  capitalReadiness: "Capital Readiness Rating",
  investorFit: "Investor Fit",
  nonBinding: "non-binding range",
} as const;

/**
 * Forbidden terms — must never appear on any CRM surface. Includes securities /
 * broker-dealer language and any reference to SPV structure in product copy.
 */
export const FORBIDDEN_TERMS = [
  "pledge",
  "soft-circle",
  "soft circle",
  "commitment",
  "exchange",
  "spv",
  "broker-dealer",
  "placement agent",
] as const;

/** Locked interest-level vocabulary for match rows. Never "pledge"/"soft-circle". */
export const INTEREST_LEVEL_LABEL: Record<string, string> = {
  watching: "Watching",
  soft: "Soft",
  indicated: "Indicated",
  advancing: "Advancing",
  passed: "Passed",
};

/** Standard non-binding disclaimer for indicated amounts. */
export const NON_BINDING_NOTE =
  "Indicated amounts are non-binding ranges. Advisory only — not an offer, solicitation, or placement.";

/** Returns forbidden terms found in a text blob (case-insensitive, word-ish match). */
export function findForbiddenTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_TERMS.filter((term) => {
    // word-boundary-ish: avoid matching inside unrelated words where possible
    const re = new RegExp(`(^|[^a-z])${term.replace(/[-\s]/g, "[-\\s]?")}([^a-z]|$)`, "i");
    return re.test(lower);
  });
}
