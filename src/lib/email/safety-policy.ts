export const EMAIL_DRAFT_SAFETY_NOTES = [
  "Draft only — CapitalOS does not send this email automatically.",
  "Not investment, legal, or tax advice.",
  "Do not guarantee funding, returns, approval, or investment outcomes.",
  "Avoid securities offering language and high-pressure urgency.",
  "Review with qualified counsel before any investor or regulatory communication.",
] as const;

const FORBIDDEN_PATTERNS = [
  /guaranteed?\s+(returns?|roi|profit)/i,
  /guaranteed?\s+funding/i,
  /risk[- ]free/i,
  /sec\s+registered\s+offering/i,
  /invest\s+now\s+or\s+miss/i,
  /legal\s+advice/i,
  /will\s+approve\s+your\s+investment/i,
];

export function validateDraftContent(subject: string, body: string): string[] {
  const warnings: string[] = [];
  const combined = `${subject}\n${body}`;
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(combined)) {
      warnings.push(`Review suggested: content may include restricted phrasing (${pattern.source}).`);
    }
  }
  return warnings;
}

export function appendSafetyFooter(body: string): string {
  return `${body.trim()}\n\n---\nThis draft was generated in CapitalOS for your review. Nothing is sent until you copy and send from your own email client. CapitalOS does not provide legal or investment advice.`;
}

export function mergeSafetyNotes(extra: string[] = []): string[] {
  return [...EMAIL_DRAFT_SAFETY_NOTES, ...extra];
}
