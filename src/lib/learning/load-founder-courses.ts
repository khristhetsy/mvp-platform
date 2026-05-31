import { courseLessonCount, courseDurationMinutes, FOUNDER_COURSES, formatCourseDuration } from "@/lib/learning/courses";
import {
  computeCoursePercentComplete,
  findContinueCourseLesson,
  loadCourseProgressMap,
} from "@/lib/learning/course-progress";
import { courseLessonHref, courseHref } from "@/lib/learning/course-keys";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import type { Profile } from "@/lib/supabase/types";
import type { Course } from "@/lib/learning/course-types";

export type FounderCourseCatalogItem = Course & {
  lessonCount: number;
  durationLabel: string;
  percentComplete: number;
  continueHref: string | null;
  hasStarted: boolean;
  href: string;
};

export async function loadFounderCourseCatalog(profile: Profile) {
  const company = await ensureFounderCompanyForUser(profile);

  if (!company) {
    return {
      company: null,
      courses: [] as FounderCourseCatalogItem[],
      categories: [] as string[],
      overallPercent: 0,
    };
  }

  const progressRows = await loadCourseProgressMap(profile.id, company.id);
  const progressList = [...progressRows.values()];

  const courses: FounderCourseCatalogItem[] = FOUNDER_COURSES.map((course) => {
    const percentComplete = computeCoursePercentComplete(course, progressList);
    const cont = findContinueCourseLesson(course, progressList);
    const hasStarted = progressList.some((r) => r.module_slug === course.slug);

    return {
      ...course,
      lessonCount: courseLessonCount(course),
      durationLabel: formatCourseDuration(courseDurationMinutes(course)),
      percentComplete,
      continueHref: cont?.href ?? courseLessonHref(course.slug, course.sections[0]?.lessons[0]?.slug ?? ""),
      hasStarted,
      href: courseHref(course.slug),
    };
  });

  const overallPercent =
    courses.length > 0
      ? Math.round(courses.reduce((sum, c) => sum + c.percentComplete, 0) / courses.length)
      : 0;

  const categories = [...new Set(courses.map((c) => c.category))].sort();

  return { company, courses, categories, overallPercent };
}
