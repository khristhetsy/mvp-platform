// Signals for the Preparation rows of the admin stage menu that have real data behind
// them: a row is done when a current upload (or a finalized in-platform plan) covers it.
// Archived files never count. Pure, so the matching can be tested without a database.

type DocLike = { document_type: string | null; status: string | null };

export type StageMenuDocSignals = {
  hasBusinessPlan: boolean;
  hasPitchDeck: boolean;
  hasCapTable: boolean;
  hasFinancialModel: boolean;
};

export function stageMenuDocSignals(docs: DocLike[], hasFinalizedPlan: boolean): StageMenuDocSignals {
  const current = new Set(
    docs
      .filter((d) => d.document_type && (d.status ?? "").toLowerCase() !== "archived")
      .map((d) => (d.document_type as string).trim().toUpperCase()),
  );
  const any = (...codes: string[]) => codes.some((c) => current.has(c));
  return {
    hasBusinessPlan: hasFinalizedPlan || any("BUSINESS_PLAN"),
    hasPitchDeck: any("PITCH_DECK"),
    hasCapTable: any("CAP_TABLE"),
    // Same aliases the document checklist uses for the "Financial model" slot.
    hasFinancialModel: any("FINANCIAL_MODEL", "FINANCIAL_STATEMENTS", "FINANCIALS"),
  };
}
