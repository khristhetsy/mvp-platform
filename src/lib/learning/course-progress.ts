import { courseLessonHref } from "@/lib/learning/course-keys";
import {
  courseLessonCount,
  flattenCourseLessons,
  getCourseBySlug,
} from "@/lib/learning/courses";
import type { Course } from "@/lib/learning/course-types";
import { lessonProgressKey } from "@/lib/learning/lesson-progress-utils";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";

export function courseProgressStorageKey(courseSlug: string, lessonSlug: string) {
  return lessonProgressKey(courseSlug, lessonSlug);
}

export function computeCoursePercentComplete(
  course: Course,
  progressRows: FounderLessonProgressRecord[],
) {
  const total = courseLessonCount(course) || 1;
  const completed = flattenCourseLessons(course).filter(({ lesson }) =>
    progressRows.some(
      (r) =>
        r.module_slug === course.slug &&
        r.lesson_id === lesson.slug &&
        r.status === "completed",
    ),
  ).length;
  return Math.round((completed / total) * 100);
}

export function isCourseLessonCompleted(
  courseSlug: string,
  lessonSlug: string,
  progressRows: FounderLessonProgressRecord[],
) {
  return progressRows.some(
    (r) => r.module_slug === courseSlug && r.lesson_id === lessonSlug && r.status === "completed",
  );
}

export function findContinueCourseLesson(course: Course, progressRows: FounderLessonProgressRecord[]) {
  const flat = flattenCourseLessons(course);
  const inProgress = flat.find(({ lesson }) =>
    progressRows.some(
      (r) =>
        r.module_slug === course.slug &&
        r.lesson_id === lesson.slug &&
        r.status === "in_progress",
    ),
  );
  if (inProgress) {
    return { lesson: inProgress.lesson, href: courseLessonHref(course.slug, inProgress.lesson.slug) };
  }

  const nextIncomplete = flat.find(
    ({ lesson }) => !isCourseLessonCompleted(course.slug, lesson.slug, progressRows),
  );
  if (nextIncomplete) {
    return { lesson: nextIncomplete.lesson, href: courseLessonHref(course.slug, nextIncomplete.lesson.slug) };
  }

  const first = flat[0];
  return first ? { lesson: first.lesson, href: courseLessonHref(course.slug, first.lesson.slug) } : null;
}

export function buildCourseCurriculumProgress(course: Course, progressRows: FounderLessonProgressRecord[]) {
  return course.sections.map((section) => ({
    section,
    lessons: section.lessons.map((lesson) => ({
      lesson,
      completed: isCourseLessonCompleted(course.slug, lesson.slug, progressRows),
      inProgress: progressRows.some(
        (r) =>
          r.module_slug === course.slug &&
          r.lesson_id === lesson.slug &&
          r.status === "in_progress",
      ),
    })),
  }));
}

export function resolveCourseNavigation(course: Course, lessonSlug: string) {
  const flat = flattenCourseLessons(course);
  const index = flat.findIndex(({ lesson }) => lesson.slug === lessonSlug);
  const prev = index > 0 ? flat[index - 1] : null;
  const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : null;
  return {
    index,
    prev: prev ? { lesson: prev.lesson, href: courseLessonHref(course.slug, prev.lesson.slug) } : null,
    next: next ? { lesson: next.lesson, href: courseLessonHref(course.slug, next.lesson.slug) } : null,
    total: flat.length,
  };
}

export function isFounderCourseSlug(slug: string) {
  return Boolean(getCourseBySlug(slug));
}
