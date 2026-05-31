import { getProgramBySlug } from "@/lib/learning/catalog";
import { enrichLesson } from "@/lib/learning/lesson-enrichment";
import { getModuleContent } from "@/lib/learning/modules";
import { getLearningModuleBySlug } from "@/lib/learning/progress";
import type { LearningLesson } from "@/lib/learning/types";

export async function resolveLessonContext(
  programSlug: string,
  moduleSlug: string,
  lessonId: string,
) {
  const program = getProgramBySlug(programSlug);
  const module = await getLearningModuleBySlug(moduleSlug);
  const content = getModuleContent(moduleSlug);

  if (!program || !module || !content || !program.moduleSlugs.includes(moduleSlug)) {
    return null;
  }

  const lessonIndex = content.lessons.findIndex((l) => l.id === lessonId);
  if (lessonIndex < 0) return null;

  const lesson = enrichLesson(content.lessons[lessonIndex], module, lessonIndex);
  const lessons: LearningLesson[] = content.lessons.map((l, i) => enrichLesson(l, module, i));

  return { program, module, content, lesson, lessonIndex, lessons };
}
