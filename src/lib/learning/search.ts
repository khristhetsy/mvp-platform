import { LEARNING_PROGRAM_CATALOG } from "@/lib/learning/catalog";
import { lessonHref } from "@/lib/learning/lesson-keys";
import { LEARNING_MODULE_CONTENT } from "@/lib/learning/modules";

export type LessonSearchResult = {
  lessonId: string;
  lessonTitle: string;
  lessonSummary: string;
  moduleSlug: string;
  moduleTitle: string;
  programSlug: string;
  programTitle: string;
  href: string;
};

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type ScoredResult = LessonSearchResult & { score: number };

export function searchLessons(query: string): LessonSearchResult[] {
  const normalized = query.toLowerCase().trim();
  if (normalized.length < 2) return [];

  const matches: ScoredResult[] = [];

  for (const program of LEARNING_PROGRAM_CATALOG) {
    for (const moduleSlug of program.moduleSlugs) {
      const content = LEARNING_MODULE_CONTENT[moduleSlug];
      if (!content) continue;

      const moduleTitle = humanizeSlug(moduleSlug);

      for (const lesson of content.lessons) {
        const title = lesson.title.toLowerCase();
        const summary = lesson.summary.toLowerCase();
        const keyPointHit = lesson.keyPoints.some((point) => point.toLowerCase().includes(normalized));

        let score = 0;
        if (title.includes(normalized)) score = 3;
        else if (summary.includes(normalized)) score = 2;
        else if (keyPointHit) score = 1;
        else continue;

        matches.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonSummary: lesson.summary,
          moduleSlug,
          moduleTitle,
          programSlug: program.slug,
          programTitle: program.title,
          href: lessonHref(program.slug, moduleSlug, lesson.id),
          score,
        });
      }
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.lessonTitle.localeCompare(b.lessonTitle))
    .slice(0, 20)
    .map(({ score: _score, ...result }) => result);
}
