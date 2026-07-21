// COMPLIANCE-MAINTAINED FILE.
// Phrases that must never appear in a public tombstone notice. Reg CF §227.204
// limits these notices to factual statements — no performance claims and no
// characterisation of risk.
//
// The matcher normalises before comparing, so a term written here in plain form
// also catches spacing and punctuation variants. Keep this list human-readable;
// the fuzziness belongs in the matcher, not in the phrases.
export const PROHIBITED_TERMS: readonly string[] = [
  "guaranteed",
  "guarantee",
  "no risk",
  "risk free",
  "riskless",
  "returns of",
  "% return",
  "percent return",
  "safe investment",
  "can't lose",
  "cant lose",
  "cannot lose",
  "sure thing",
  "double your money",
  "get rich",
  "high yield",
  "assured return",
  "promised return",
];

/**
 * Misspellings that would otherwise sail past a literal match. Deliberately
 * narrow — this is not a spellchecker, just the variants people actually type.
 */
const MISSPELLINGS: ReadonlyArray<[RegExp, string]> = [
  // Covers guaranteed / guarunteed / guarenteed / gauranteed / guarantee, i.e.
  // both transpositions of "gua"/"gau" and any vowel in the second syllable.
  [/\bg[au]{2}r[aeiou]nte+d?\b/g, "guaranteed"],
  [/\brisk[-\s]?free\b/g, "risk free"],
];

/**
 * Normalise text for matching: lowercase, fold known misspellings, strip the
 * punctuation people use to break a phrase up ("risk-free", "s.a.f.e"), and close
 * the gap before a percent sign so "20 % return" reads as "20% return".
 */
export function normaliseForMatch(text: string): string {
  let out = text.toLowerCase();
  for (const [pattern, replacement] of MISSPELLINGS) out = out.replace(pattern, replacement);
  return out
    .replace(/([a-z])[.\-_*]+(?=[a-z])/g, "$1")
    .replace(/\s+%/g, "%")
    .replace(/[^\w%'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prohibited phrases found in a single piece of text. */
export function findProhibitedTerms(text: string): string[] {
  const normalised = normaliseForMatch(text);
  return PROHIBITED_TERMS.filter((t) => normalised.includes(normaliseForMatch(t)));
}

/**
 * Scan every founder-supplied field that reaches the public tombstone, not just
 * the description. "Guaranteed 20% Return Notes" is a plausible security type and
 * previously passed unchecked because only briefDescription was linted.
 */
export function findProhibitedTermsInFields(
  fields: Record<string, string | null | undefined>,
): Array<{ field: string; terms: string[] }> {
  const hits: Array<{ field: string; terms: string[] }> = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const terms = findProhibitedTerms(value);
    if (terms.length > 0) hits.push({ field, terms });
  }
  return hits;
}
