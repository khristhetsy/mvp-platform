export const FUNDRAISING_RISKY_PHRASES = [
  "guaranteed return",
  "guaranteed investment",
  "risk-free",
  "guaranteed funding",
  "sec approved",
  "sec approved investment",
  "assured profit",
  "insider information",
  "no-risk opportunity",
] as const;

export function detectRiskyPhrases(text: string, patterns: readonly string[] = FUNDRAISING_RISKY_PHRASES) {
  const normalized = text.toLowerCase();
  return patterns.filter((phrase) => normalized.includes(phrase));
}

export function hasRiskyPhrases(text: string) {
  return detectRiskyPhrases(text).length > 0;
}
