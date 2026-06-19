// Canonical Qualify document requirements.
//
// The documents table stores `document_type` as UPPERCASE codes written by the
// upload route (e.g. PITCH_DECK, FINANCIAL_STATEMENTS, CAP_TABLE — the "FINANCIALS"
// input is normalised to FINANCIAL_STATEMENTS). The journey evaluator and the
// Qualify screen MUST match against these same codes, so this is the single
// source of truth both import. Matching is case-insensitive and alias-aware so
// legacy/lowercase rows still count.

export type QualifyDocument = {
  /** Canonical stored document_type code. */
  code: string;
  /** Alternate codes that satisfy this requirement. */
  aliases: string[];
  label: string;
  /** Contextual unblock: the learning topic that helps produce this doc. */
  learningTopic: string;
};

export const QUALIFY_REQUIRED_DOCUMENTS: QualifyDocument[] = [
  {
    code: "PITCH_DECK",
    aliases: ["pitch_deck"],
    label: "Pitch deck",
    learningTopic: "Pitch deck fundamentals",
  },
  {
    code: "FINANCIAL_STATEMENTS",
    aliases: ["financials", "FINANCIALS", "financial_statements"],
    label: "Financial statements",
    learningTopic: "Financial modeling basics",
  },
  {
    code: "CAP_TABLE",
    aliases: ["cap_table"],
    label: "Cap table",
    learningTopic: "How to build a cap table",
  },
];

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

/** All accepted codes (canonical + aliases), normalised to uppercase. */
function acceptedCodes(doc: QualifyDocument): Set<string> {
  return new Set([doc.code, ...doc.aliases].map(normalize));
}

/** True when an uploaded set satisfies a single required document. */
export function isQualifyDocSatisfied(
  uploadedTypes: Iterable<string | null | undefined>,
  doc: QualifyDocument,
): boolean {
  const accepted = acceptedCodes(doc);
  for (const type of uploadedTypes) {
    if (type && accepted.has(normalize(type))) return true;
  }
  return false;
}

/** True when every required Qualify document has been uploaded. */
export function allQualifyDocsUploaded(
  uploadedTypes: Iterable<string | null | undefined>,
): boolean {
  const list = Array.from(uploadedTypes);
  return QUALIFY_REQUIRED_DOCUMENTS.every((doc) => isQualifyDocSatisfied(list, doc));
}
