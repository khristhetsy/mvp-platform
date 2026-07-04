// Prospect Pipeline — Step 5: channel-agnostic compliance lint. Any flag holds
// an item at `lint_flagged`, which can never reach `scheduled`/`sent`. This is
// the approved-language gate — the source of truth for outbound copy.

import { findForbiddenTerms } from "@/lib/crm/lexicon";

// Deprecated brand palette (mirrors scripts/predeploy-check.mjs). Built from
// split digits so this source file itself doesn't trip the brand-hex guardrail.
const DEPRECATED_HEX = ["0D9488", "5EEAD4", "534AB7", "3C3489"].map((h) => new RegExp("#" + h, "i"));

// Funding-outcome language — never permitted in the engagement register.
const FUNDING_OUTCOME: RegExp[] = [
  /\bget(ting)?\s+funded\b/i,
  /\bguarantee(d)?\b/i,
  /\brisk[-\s]?free\b/i,
  /\bassured\b/i,
  /\bguaranteed returns?\b/i,
  /\bROI\b/,
  /\bdouble your\b/i,
  /\bwill raise\b/i,
  /\braise\s+\$?\d/i,
  /\b\d+x returns?\b/i,
];

// High-pressure / urgency language.
const PRESSURE: RegExp[] = [
  /\bact now\b/i,
  /\blimited time\b/i,
  /\blast chance\b/i,
  /\bhurry\b/i,
  /\bdon'?t miss\b/i,
  /\burgent\b/i,
  /\bexpires? (today|soon)\b/i,
];

export interface LintFlag {
  rule: "forbidden_terms" | "funding_outcome" | "deprecated_brand" | "pressure_language";
  detail: string;
}

export interface LintResult {
  ok: boolean;
  flags: LintFlag[];
}

export interface PublishBody {
  subject?: string | null;
  html?: string | null;
  text?: string | null;
}

/** Four-gate approved-language + brand lint over an item's title and body. */
export function lintCopy(title: string, body: PublishBody): LintResult {
  const corpus = [title, body.subject, body.text, body.html].filter(Boolean).join("\n");
  const flags: LintFlag[] = [];

  const forbidden = findForbiddenTerms(corpus);
  if (forbidden.length) flags.push({ rule: "forbidden_terms", detail: forbidden.join(", ") });

  for (const re of FUNDING_OUTCOME) {
    const m = corpus.match(re);
    if (m) { flags.push({ rule: "funding_outcome", detail: m[0] }); break; }
  }

  for (const re of DEPRECATED_HEX) {
    if (re.test(corpus)) { flags.push({ rule: "deprecated_brand", detail: re.source.replace(/\\/g, "") }); break; }
  }

  for (const re of PRESSURE) {
    const m = corpus.match(re);
    if (m) { flags.push({ rule: "pressure_language", detail: m[0] }); break; }
  }

  return { ok: flags.length === 0, flags };
}
