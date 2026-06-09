import { LEARNING_PROGRAM_CATALOG } from "@/lib/learning/catalog";
import { progressByModuleId } from "@/lib/learning/progress-utils";
import type { LearningModuleRecord, LearningProgressRecord, LearningReadinessStage, StageAccessMap } from "@/lib/learning/types";

export type { StageAccessMap };

const STAGE_UNLOCK_CHAIN: Array<{ stage: LearningReadinessStage; requires: LearningReadinessStage | null }> = [
  { stage: "foundation", requires: null },
  { stage: "readiness", requires: "foundation" },
  { stage: "capital", requires: "readiness" },
  { stage: "engagement", requires: "capital" },
  { stage: "institutional", requires: "engagement" },
];

const UNLOCK_THRESHOLD = 80;

export function moduleSlugsForStage(stage: LearningReadinessStage) {
  const slugs = new Set<string>();
  for (const program of LEARNING_PROGRAM_CATALOG) {
    if (program.stage === stage) {
      for (const moduleSlug of program.moduleSlugs) {
        slugs.add(moduleSlug);
      }
    }
  }
  return [...slugs];
}

export function computeStageCompletionPercent(
  stage: LearningReadinessStage,
  modules: LearningModuleRecord[],
  progressRows: LearningProgressRecord[],
) {
  const slugs = new Set(moduleSlugsForStage(stage));
  const stageModules = modules.filter((module) => slugs.has(module.slug));
  if (stageModules.length === 0) return 100;

  const progressMap = progressByModuleId(progressRows);
  const total = stageModules.reduce((sum, module) => sum + (progressMap.get(module.id)?.percent_complete ?? 0), 0);
  return Math.round(total / stageModules.length);
}

export function computeStageAccess(
  modules: LearningModuleRecord[],
  progressRows: LearningProgressRecord[],
): StageAccessMap {
  const percents = Object.fromEntries(
    STAGE_UNLOCK_CHAIN.map(({ stage }) => [stage, computeStageCompletionPercent(stage, modules, progressRows)]),
  ) as Record<LearningReadinessStage, number>;

  const access: StageAccessMap = {
    foundation: true,
    readiness: false,
    capital: false,
    engagement: false,
    institutional: false,
  };

  for (const { stage, requires } of STAGE_UNLOCK_CHAIN) {
    if (requires === null) {
      access[stage] = true;
      continue;
    }
    access[stage] = percents[requires] >= UNLOCK_THRESHOLD;
  }

  return access;
}

export function previousStageLabel(stage: LearningReadinessStage) {
  const labels: Record<LearningReadinessStage, string> = {
    foundation: "Foundation",
    readiness: "Foundation",
    capital: "Readiness",
    engagement: "Capital",
    institutional: "Engagement",
  };
  return labels[stage];
}

export function isModuleStageUnlocked(
  moduleStage: LearningReadinessStage,
  stageAccess: StageAccessMap,
) {
  return stageAccess[moduleStage];
}
