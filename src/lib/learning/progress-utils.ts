import type { LearningModuleRecord, LearningProgressRecord } from "@/lib/learning/types";

export function progressByModuleId(rows: LearningProgressRecord[]) {
  return new Map(rows.map((row) => [row.module_id, row]));
}

export function computeOverallLearningPercent(
  modules: LearningModuleRecord[],
  progressRows: LearningProgressRecord[],
) {
  if (modules.length === 0) return 0;

  const progressMap = progressByModuleId(progressRows);
  let total = 0;

  for (const learningModule of modules) {
    total += progressMap.get(learningModule.id)?.percent_complete ?? 0;
  }

  return Math.round(total / modules.length);
}

export function applyLearningReadinessBonus(baseScore: number | null, bonus: number | null | undefined) {
  const base = baseScore ?? 0;
  const extra = bonus ?? 0;
  if (extra <= 0) return baseScore;
  return Math.min(100, base + extra);
}
