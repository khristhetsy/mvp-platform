import { encodeLessonKey, lessonHref } from "@/lib/learning/lesson-keys";
import { getModuleContent } from "@/lib/learning/modules";
import { enrichLesson } from "@/lib/learning/lesson-enrichment";
import type { LessonRecommendation, LearningModuleRecord } from "@/lib/learning/types";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";
import { getProgramForModuleSlug } from "@/lib/learning/catalog";
import { buildLearningRecommendations } from "@/lib/learning/recommendations";
import type { RemediationCategory } from "@/lib/remediation/types";

export function buildLessonRecommendations(input: {
  modules: LearningModuleRecord[];
  lessonProgress: FounderLessonProgressRecord[];
  remediationSourceKeys: Array<{ source_key: string; category: RemediationCategory; priority: string }>;
  onboardingPercent: number;
  readinessScore: number | null;
  hasDiligenceReport: boolean;
  hasPitchDeck: boolean;
  hasFinancials: boolean;
  reviewStatus: string | null;
  hasCompanyUpdates: boolean;
}): LessonRecommendation[] {
  const moduleRecs = buildLearningRecommendations({
    modules: input.modules,
    remediationSourceKeys: input.remediationSourceKeys,
    onboardingPercent: input.onboardingPercent,
    readinessScore: input.readinessScore,
    hasDiligenceReport: input.hasDiligenceReport,
    hasPitchDeck: input.hasPitchDeck,
    reviewStatus: input.reviewStatus,
  });

  const completed = new Set(
    input.lessonProgress
      .filter((r) => r.status === "completed")
      .map((r) => `${r.module_slug}:${r.lesson_id}`),
  );

  const lessons: LessonRecommendation[] = [];

  for (const rec of moduleRecs) {
    const learningModule = input.modules.find((m) => m.slug === rec.slug);
    const content = getModuleContent(rec.slug);
    if (!learningModule || !content) continue;

    const program = getProgramForModuleSlug(rec.slug);
    const nextLesson = content.lessons.find((l) => !completed.has(`${rec.slug}:${l.id}`));
    if (!nextLesson) continue;

    const enriched = enrichLesson(nextLesson, learningModule, 0);
    lessons.push({
      programSlug: program.slug,
      moduleSlug: rec.slug,
      lessonId: nextLesson.id,
      lessonTitle: enriched.title,
      reason: rec.reason,
      priority: rec.priority,
      href: lessonHref(program.slug, rec.slug, nextLesson.id),
    });
  }

  if (!input.hasPitchDeck) {
    pushLesson(lessons, input.modules, "pitch-deck-fundamentals", "deck-structure", {
      reason: "Pitch deck missing — build an investor-ready deck.",
      priority: "high",
    }, completed);
  }

  if (!input.hasFinancials) {
    pushLesson(lessons, input.modules, "financial-projections", "projection-basics", {
      reason: "Financial statements missing — strengthen financial readiness.",
      priority: "high",
    }, completed);
  }

  if (input.onboardingPercent < 100) {
    pushLesson(lessons, input.modules, "investor-ready-company-profiles", "profile-screening", {
      reason: "Profile incomplete — how investors screen founder profiles.",
      priority: "high",
    }, completed);
  }

  if (!input.hasDiligenceReport) {
    pushLesson(lessons, input.modules, "due-diligence-preparation", "dd-workflow", {
      reason: "No diligence report yet — prepare materials first.",
      priority: "medium",
    }, completed);
  }

  if (!input.hasCompanyUpdates) {
    pushLesson(lessons, input.modules, "investor-updates", "update-format", {
      reason: "No investor updates published — institutional communication practice.",
      priority: "medium",
    }, completed);
  }

  const order = { high: 0, medium: 1, low: 2 };
  return lessons
    .filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i)
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 8);
}

function pushLesson(
  list: LessonRecommendation[],
  modules: LearningModuleRecord[],
  moduleSlug: string,
  lessonId: string,
  meta: { reason: string; priority: "high" | "medium" | "low" },
  completed: Set<string>,
) {
  if (completed.has(`${moduleSlug}:${lessonId}`)) return;
  const learningModule = modules.find((m) => m.slug === moduleSlug);
  const content = getModuleContent(moduleSlug);
  const lesson = content?.lessons.find((l) => l.id === lessonId) ?? content?.lessons[0];
  if (!learningModule || !lesson) return;

  const program = getProgramForModuleSlug(moduleSlug);
  list.push({
    programSlug: program.slug,
    moduleSlug,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    reason: meta.reason,
    priority: meta.priority,
    href: lessonHref(program.slug, moduleSlug, lesson.id),
  });
}

export function findNextLessonRecommendation(
  recommendations: LessonRecommendation[],
  lessonProgress: FounderLessonProgressRecord[],
): LessonRecommendation | null {
  if (recommendations[0]) return recommendations[0];

  for (const row of lessonProgress) {
    if (row.status === "in_progress") {
      const program = getProgramForModuleSlug(row.module_slug);
      const content = getModuleContent(row.module_slug);
      const lesson = content?.lessons.find((l) => l.id === row.lesson_id);
      if (!lesson) continue;
      return {
        programSlug: program.slug,
        moduleSlug: row.module_slug,
        lessonId: row.lesson_id,
        lessonTitle: lesson.title,
        reason: "Resume your in-progress lesson.",
        priority: "medium",
        href: lessonHref(program.slug, row.module_slug, row.lesson_id),
      };
    }
  }

  return null;
}

export function detectLearningWeaknesses(input: {
  readinessScore: number | null;
  hasPitchDeck: boolean;
  hasFinancials: boolean;
  onboardingPercent: number;
  remediationHighPriority: number;
  hasDiligenceReport: boolean;
}): string[] {
  const weaknesses: string[] = [];
  if (!input.hasPitchDeck) weaknesses.push("Investor materials: pitch deck not uploaded");
  if (!input.hasFinancials) weaknesses.push("Financial readiness: statements missing");
  if (input.onboardingPercent < 100) weaknesses.push("Company profile: onboarding incomplete");
  if (!input.hasDiligenceReport) weaknesses.push("Diligence: no readiness report generated");
  if ((input.readinessScore ?? 0) > 0 && (input.readinessScore ?? 0) < 55) {
    weaknesses.push("Readiness score below institutional conversation threshold");
  }
  if (input.remediationHighPriority > 0) {
    weaknesses.push(`${input.remediationHighPriority} high-priority remediation item(s) open`);
  }
  return weaknesses;
}
