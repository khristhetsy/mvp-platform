import { courseLessonCount, courseDurationMinutes, FOUNDER_COURSES, formatCourseDuration } from "@/lib/learning/courses";
import { computeCoursePercentComplete, findContinueCourseLesson } from "@/lib/learning/course-progress";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { courseLessonHref, courseHref } from "@/lib/learning/course-keys";
import { listPublishedAdminCourses } from "@/lib/learning/admin-courses";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import type { Profile } from "@/lib/supabase/types";
import type { Course } from "@/lib/learning/course-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COACH_COURSES } from "@/lib/learning/coach/courses";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { coachLessonHref } from "@/lib/learning/coach/program-links";

export type FounderCourseCatalogItem = Course & {
  lessonCount: number;
  durationLabel: string;
  percentComplete: number;
  continueHref: string | null;
  hasStarted: boolean;
  href: string;
  /** True for a coach format course the founder is enrolled in: it opens the coached lesson page. */
  coached?: boolean;
};

export async function loadFounderCourseCatalog(profile: Profile) {
  const { company } = await getActiveCompanyForUser(profile);

  if (!company) {
    return {
      company: null,
      courses: [] as FounderCourseCatalogItem[],
      categories: [] as string[],
      overallPercent: 0,
    };
  }

  const progressList = await listLessonProgressForCompany(profile.id, company.id);

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

  // Coach format courses appear only while the coach is active for this founder (enrolled, course on).
  // They stay out of the overall progress average, which is computed over the core and admin courses.
  const coachedCourses: FounderCourseCatalogItem[] = [];
  for (const course of COACH_COURSES) {
    const access = await getCoachAccess(supabase as unknown as SupabaseClient, { founderId: profile.id, companyId: company.id, courseSlug: course.slug }).catch(() => null);
    if (!access?.active) continue;
    const percentComplete = computeCoursePercentComplete(course, progressList);
    const cont = findContinueCourseLesson(course, progressList);
    const nextLesson = cont?.lesson.slug ?? course.sections[0]?.lessons[0]?.slug ?? "";
    coachedCourses.push({
      ...course,
      category: "Coached",
      lessonCount: courseLessonCount(course),
      durationLabel: formatCourseDuration(courseDurationMinutes(course)),
      percentComplete,
      continueHref: coachLessonHref(course.slug, nextLesson),
      hasStarted: progressList.some((r) => r.module_slug === course.slug),
      href: coachLessonHref(course.slug, nextLesson),
      coached: true,
    });
  }
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
      instructor: "iCapOS Faculty",
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

  const graded = [...coreCourses.map((c) => ({ ...c, category: `iCapOS Core · ${c.category}` })), ...adminCourses];
  const overallPercent =
    graded.length > 0
      ? Math.round(graded.reduce((sum, c) => sum + c.percentComplete, 0) / graded.length)
      : 0;
  const courses = [...coachedCourses, ...graded];

  const categories = [...new Set(courses.map((c) => c.category))].sort();

  return { company, courses, categories, overallPercent };
}
