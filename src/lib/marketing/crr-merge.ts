/**
 * Capital Readiness Rating merge fields for marketing email: {{starting_crr}} and
 * {{current_crr}}. Pure helpers only (no DB) so they unit test in isolation; the
 * per-recipient lookup lives in crr-merge-db.ts.
 */

/** Matches {{starting_crr}} / {{current_crr}} in any of the brace/case forms interpolate() accepts. */
const CRR_TOKEN_RE = /\{\{?\s*(starting|start|current)[ _]crr\s*\}?\}/i;

export function usesCrrTokens(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => typeof t === "string" && CRR_TOKEN_RE.test(t));
}

export type CrrScoreRow = { company_id: string; effective_score: number | null; created_at: string };
export type CrrChange = { starting_crr: string; current_crr: string };

/**
 * Starting CRR = the company's first recorded score, current CRR = its latest.
 * When the founder has several companies, the one scored most recently wins.
 * Returns null unless the rating actually went up, so the "went from X to Y"
 * line is never sent to a founder whose score is flat, down, or unscored.
 */
export function computeCrrChange(rows: CrrScoreRow[]): CrrChange | null {
  const scored = rows
    .filter((r) => typeof r.effective_score === "number" && Number.isFinite(r.effective_score))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (scored.length < 2) return null;
  const companyId = scored[scored.length - 1].company_id;
  const own = scored.filter((r) => r.company_id === companyId);
  if (own.length < 2) return null;
  const start = Math.round(own[0].effective_score as number);
  const current = Math.round(own[own.length - 1].effective_score as number);
  if (current <= start) return null;
  return { starting_crr: String(start), current_crr: String(current) };
}

/** Sample values for [TEST] sends, which go to staff addresses with no CRR history. */
export const SAMPLE_CRR: CrrChange = { starting_crr: "52", current_crr: "78" };
