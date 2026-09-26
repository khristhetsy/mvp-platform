/**
 * The open items a founder below the outreach gate should see: one unresolved
 * flag per factor, taken from the factors with the most points still on the
 * table. Pure, so the matches page and its tests read it the same way.
 */
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

export type OpenRatingItem = { factor: string; label: string; detail: string; gap: number };

export function openRatingItems(
  factorScores: Partial<Record<FactorKey, FactorScore>>,
  factorLabel: Partial<Record<FactorKey, string>>,
  limit = 3,
): OpenRatingItem[] {
  const items: OpenRatingItem[] = [];
  for (const [key, score] of Object.entries(factorScores) as Array<[FactorKey, FactorScore | undefined]>) {
    if (!score || !Array.isArray(score.flags)) continue;
    const flag = score.flags.find((f) => f.severity === "red") ?? score.flags.find((f) => f.severity === "amber");
    if (!flag) continue;
    const gap = Math.max(0, (Number(score.max) || 0) - (Number(score.pts) || 0));
    items.push({ factor: factorLabel[key] ?? key, label: flag.label, detail: flag.detail, gap });
  }
  return items.sort((a, b) => b.gap - a.gap).slice(0, limit);
}
