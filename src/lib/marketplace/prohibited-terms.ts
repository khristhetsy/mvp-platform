// COMPLIANCE-MAINTAINED FILE.
// Phrases that must never appear in a public tombstone description. Used by the
// listing-creation lint (separate ticket). Case-insensitive substring match.
export const PROHIBITED_TERMS: readonly string[] = [
  "guaranteed",
  "no risk",
  "returns of",
  "% return",
  "safe investment",
  "can't lose",
  "cant lose",
];

export function findProhibitedTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return PROHIBITED_TERMS.filter((t) => lower.includes(t));
}
