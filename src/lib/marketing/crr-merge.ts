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

/** Smallest CRR rise worth quoting back to a founder; smaller moves are skipped. */
export const MIN_CRR_GAIN = 10;

/**
 * Starting CRR = a company's first recorded score, current CRR = its latest.
 * When the founder has several companies, the one with the largest rise wins
 * (so an auto-created placeholder company never hides the real one; ties go
 * to the higher current score). Returns null unless the rise is at least
 * MIN_CRR_GAIN points.
 */
export function computeCrrChange(rows: CrrScoreRow[]): CrrChange | null {
  const byCompany = new Map<string, number[]>();
  const scored = rows
    .filter((r) => typeof r.effective_score === "number" && Number.isFinite(r.effective_score))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const r of scored) {
    const list = byCompany.get(r.company_id) ?? [];
    list.push(Math.round(r.effective_score as number));
    byCompany.set(r.company_id, list);
  }
  let best: { start: number; current: number } | null = null;
  for (const list of byCompany.values()) {
    if (list.length < 2) continue;
    const start = list[0];
    const current = list[list.length - 1];
    const gain = current - start;
    if (gain < MIN_CRR_GAIN) continue;
    if (!best || gain > best.current - best.start || (gain === best.current - best.start && current > best.current)) {
      best = { start, current };
    }
  }
  return best ? { starting_crr: String(best.start), current_crr: String(best.current) } : null;
}

/** Sample values for [TEST] sends, which go to staff addresses with no CRR history. */
export const SAMPLE_CRR: CrrChange = { starting_crr: "52", current_crr: "78" };
