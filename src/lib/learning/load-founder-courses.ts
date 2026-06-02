import { courseLessonCount, courseDurationMinutes, FOUNDER_COURSES, formatCourseDuration } from "@/lib/learning/courses";
import {
  computeCoursePercentComplete,
  findContinueCourseLesson,
  loadCourseProgressMap,
} from "@/lib/learning/course-progress";
import { courseLessonHref, courseHref } from "@/lib/learning/course-keys";
import { listPublishedAdminCourses } from "@/lib/learning/admin-courses";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import type { Profile } from "@/lib/supabase/types";
import type { Course } from "@/lib/learning/course-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const coreCourses: FounderCourseCatalogItem[] = FOUNDER_COURSES.map((course) => {
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

  const adminPrograms = await listPublishedAdminCourses().catch(() => []);
  const supabase = await createServerSupabaseClient();
  const { data: adminProgressRows } = adminPrograms.length
    ? await supabase
        .from("learning_course_progress")
        .select("program_id, status")
        .eq("founder_id", profile.id)
        .eq("company_id", company.id)
        .in(
          "program_id",
          adminPrograms.map((p) => p.id),
        )
    : { data: [] as Array<{ program_id: string; status: string }> };
  const progressByProgram = new Map((adminProgressRows ?? []).map((r) => [r.program_id, r.status]));

  const adminCourses: FounderCourseCatalogItem[] = adminPrograms.map((p) => {
    const level =
      String(p.difficulty ?? "").toLowerCase() === "introductory"
        ? "Beginner"
        : String(p.difficulty ?? "").toLowerCase() === "advanced"
          ? "Advanced"
          : "Intermediate";

    const slug = `admin-${p.id}`;
    const status = progressByProgram.get(p.id) ?? null;
    const percentComplete = status === "completed" ? 100 : status === "in_progress" ? 10 : 0;
    const hasStarted = Boolean(status && status !== "not_started");

    const course: Course = {
      slug,
      title: p.title,
      description: p.description,
      longDescription:
        "Educational content only — not legal, tax, securities, or investment advice. No guarantee of funding outcomes.",
      instructor: "CapitalOS Faculty",
      category: p.category ?? "Admin Learning",
      level,
      thumbnailAccent: "from-indigo-600 to-slate-900",
      whatYouWillLearn: [],
      sections: [],
    };

    return {
      ...course,
      lessonCount: 0,
      durationLabel: "—",
      percentComplete,
      continueHref: `/founder/learning/courses/${p.id}`,
      hasStarted,
      href: `/founder/learning/courses/${p.id}`,
    };
  });

  const courses = [...coreCourses.map((c) => ({ ...c, category: `CapitalOS Core · ${c.category}` })), ...adminCourses];
  const overallPercent =
    courses.length > 0
      ? Math.round(courses.reduce((sum, c) => sum + c.percentComplete, 0) / courses.length)
      : 0;

  const categories = [...new Set(courses.map((c) => c.category))].sort();

  return { company, courses, categories, overallPercent };
}
