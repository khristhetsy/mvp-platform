export const SOCIAL_COMPLIANCE_WARNINGS = [
  "Review before posting.",
  "Do not include confidential securities offering details.",
  "Do not promise returns.",
  "Do not imply guaranteed funding.",
  "Use only approved public information.",
] as const;

const RISKY_PHRASE_PATTERNS = [
  "guaranteed return",
  "guaranteed investment",
  "risk-free",
  "guaranteed funding",
  "sec approved",
  "assured profit",
] as const;

export function detectRiskyPhrases(body: string): string[] {
  const normalized = body.toLowerCase();
  return RISKY_PHRASE_PATTERNS.filter((phrase) => normalized.includes(phrase));
}

export function resolveSocialDraftComplianceStatus(body: string): "needs_review" | "approved" | "flagged" {
  const risky = detectRiskyPhrases(body);
  if (risky.length > 0) {
    return "flagged";
  }
  return "needs_review";
}
