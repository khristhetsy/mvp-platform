import { lessonCountForSlug } from "@/lib/learning/modules";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";

export function lessonProgressKey(moduleSlug: string, lessonId: string) {
  return `${moduleSlug}:${lessonId}`;
}

export function progressByLessonKey(rows: FounderLessonProgressRecord[]) {
  return new Map(rows.map((row) => [lessonProgressKey(row.module_slug, row.lesson_id), row]));
}

export function countCompletedLessons(
  rows: FounderLessonProgressRecord[],
  moduleSlug?: string,
) {
  return rows.filter(
    (r) => r.status === "completed" && (moduleSlug ? r.module_slug === moduleSlug : true),
  ).length;
}

export function moduleLessonCompletionPercent(
  moduleSlug: string,
  rows: FounderLessonProgressRecord[],
) {
  const total = lessonCountForSlug(moduleSlug) || 1;
  const done = countCompletedLessons(rows, moduleSlug);
  return Math.round((done / total) * 100);
}
