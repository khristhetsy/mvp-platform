/**
 * Gaps: questions founders marked "I still need a person" under an assistant
 * answer. Pure, so it is tested without a database. A gap drops off the list
 * when an admin dismisses it or a taught answer now covers the question.
 */
import { taughtAnswerFor } from "@/lib/ir-agent/scripted";
import type { TaughtAnswer } from "@/lib/ir-agent/types";

export type GapEvent = { detail: string | null; created_at: string };
export type Gap = { key: string; question: string; count: number; lastAskedAt: string };

/** Same question asked in different case or punctuation counts once. */
export function gapKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function buildGaps(events: GapEvent[], dismissed: string[], taught: TaughtAnswer[], limit = 30): Gap[] {
  const skip = new Set(dismissed);
  const groups = new Map<string, Gap>();
  for (const e of events) {
    const question = (e.detail ?? "").trim();
    const key = gapKey(question);
    if (key.length < 3 || skip.has(key)) continue;
    const seen = groups.get(key);
    if (seen) {
      seen.count += 1;
      if (e.created_at > seen.lastAskedAt) seen.lastAskedAt = e.created_at;
    } else {
      groups.set(key, { key, question: question.slice(0, 200), count: 1, lastAskedAt: e.created_at });
    }
  }
  return [...groups.values()]
    .filter((g) => !taughtAnswerFor(g.question, taught))
    .sort((a, b) => b.count - a.count || (a.lastAskedAt < b.lastAskedAt ? 1 : -1))
    .slice(0, limit);
}
