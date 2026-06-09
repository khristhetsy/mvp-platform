import { getProgramBySlug } from "@/lib/learning/catalog";
import { enrichLesson } from "@/lib/learning/lesson-enrichment";
import { getModuleContentWithOverrides } from "@/lib/learning/lesson-content-overrides";
import { getLearningModuleBySlug } from "@/lib/learning/progress";
import type { LearningLesson } from "@/lib/learning/types";

export async function resolveLessonContext(
  programSlug: string,
  moduleSlug: string,
  lessonId: string,
) {
  const program = getProgramBySlug(programSlug);
  const learningModule = await getLearningModuleBySlug(moduleSlug);
  const content = await getModuleContentWithOverrides(moduleSlug);

  if (!program || !learningModule || !content || !program.moduleSlugs.includes(moduleSlug)) {
    return null;
  }

  const lessonIndex = content.lessons.findIndex((l) => l.id === lessonId);
  if (lessonIndex < 0) return null;

  const lesson = enrichLesson(content.lessons[lessonIndex], learningModule, lessonIndex);
  const lessons: LearningLesson[] = content.lessons.map((l, i) => enrichLesson(l, learningModule, i));

  return { program, module: learningModule, content, lesson, lessonIndex, lessons };
}
