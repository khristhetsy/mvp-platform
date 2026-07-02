// AEO language-library check. Runs the definition answer + every FAQ answer + the
// lede/sections through four rule families. Any hit flags the page and blocks
// publish (§6). Register-safe copy is "engagement register, causal-not-predictive."
//
// The four checks:
//   1. register  — outcome-register language (promising fundraising outcomes)
//   2. causal    — predictive/guarantee claims (must be descriptive, not predictive)
//   3. firewall  — offer/solicitation language (education ≠ securities offering)
//   4. identity  — misrepresenting regulated status (broker-dealer / RIA / SEC)

export type AeoCheckId = "register" | "causal" | "firewall" | "identity";

export interface AeoViolation {
  check: AeoCheckId;
  phrase: string;
  field: string; // where it was found (e.g. "definitionAnswer", "faq[1].a")
}

export interface AeoComplianceResult {
  status: "cleared" | "flagged";
  violations: AeoViolation[];
}

// Phrase lists are lowercase; matching is case-insensitive, word-ish boundaries.
const RULES: Record<AeoCheckId, string[]> = {
  register: [
    "raise faster", "get funded", "close your round", "raise capital quickly",
    "raise more", "secure funding", "guaranteed funding", "funding guaranteed",
    "win investors", "get investment", "unlock capital", "fast-track your raise",
    "close the deal", "get the check",
  ],
  causal: [
    "will raise", "will get funded", "guarantees", "guaranteed returns",
    "guaranteed return", "ensures funding", "leads to funding", "results in investment",
    "risk-free", "assured profit", "no-risk", "guaranteed investment",
  ],
  firewall: [
    "invest now", "buy shares", "buy this deal", "invest in this deal",
    "offer to invest", "investment opportunity", "subscribe now", "purchase securities",
    "buy in", "invest today",
  ],
  identity: [
    "sec approved", "sec-approved", "registered broker", "broker-dealer",
    "registered investment advisor", "registered investment adviser",
    "we are your financial advisor", "licensed to sell securities", "fdic insured",
  ],
};

function scanField(text: string, field: string): AeoViolation[] {
  const hay = ` ${text.toLowerCase()} `;
  const out: AeoViolation[] = [];
  (Object.keys(RULES) as AeoCheckId[]).forEach((check) => {
    for (const phrase of RULES[check]) {
      if (hay.includes(phrase)) out.push({ check, phrase, field });
    }
  });
  return out;
}

export interface AeoCheckInput {
  lede?: string;
  definitionAnswer: string;
  sections?: { heading: string; body: string }[];
  faq?: { q: string; a: string }[];
}

export function runAeoComplianceCheck(input: AeoCheckInput): AeoComplianceResult {
  const violations: AeoViolation[] = [];
  if (input.lede) violations.push(...scanField(input.lede, "lede"));
  violations.push(...scanField(input.definitionAnswer, "definitionAnswer"));
  (input.sections ?? []).forEach((s, i) => {
    violations.push(...scanField(`${s.heading} ${s.body}`, `sections[${i}]`));
  });
  (input.faq ?? []).forEach((f, i) => {
    violations.push(...scanField(f.q, `faq[${i}].q`));
    violations.push(...scanField(f.a, `faq[${i}].a`));
  });
  return { status: violations.length === 0 ? "cleared" : "flagged", violations };
}

export const AEO_CHECK_LABELS: Record<AeoCheckId, string> = {
  register: "Outcome-register language",
  causal: "Predictive / guarantee claims",
  firewall: "Offer / solicitation language",
  identity: "Regulated-status misrepresentation",
};
