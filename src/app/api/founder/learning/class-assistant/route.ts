import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import {
  buildCatalogCoachContext,
  buildPersonalCoachContext,
  COACH_DISCLAIMER,
  resolveCoachLesson,
  runPersonalCoach,
  type CoachMessage,
} from "@/lib/learning/class-assistant";
import { computeCoursePercentComplete } from "@/lib/learning/course-progress";
import { FOUNDER_COURSES } from "@/lib/learning/courses";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { getAICoachRecommendations } from "@/lib/learning/recommendations";
import { listPublishedAdminCourses } from "@/lib/learning/admin-courses";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const courseSlug =
    typeof body.courseSlug === "string" && body.courseSlug.trim() ? body.courseSlug.trim() : null;
  const lessonSlug =
    typeof body.lessonSlug === "string" && body.lessonSlug.trim() ? body.lessonSlug.trim() : null;
  const message = typeof body.message === "string" ? body.message : "";
  const history = Array.isArray(body.history)
    ? (body.history as CoachMessage[]).filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
    : [];

  const company = await ensureFounderCompanyForUser(auth.profile);
  const [progressRows, gapBasedRecommendations] = company
    ? await Promise.all([
        listLessonProgressForCompany(auth.profile.id, company.id),
        getAICoachRecommendations(auth.profile.id, company.id),
      ])
    : [[], []];

  const founderName = auth.profile.full_name ?? auth.profile.email ?? "Founder";
  const companyName = company?.company_name ?? null;

  if (!courseSlug) {
    const overallPercent =
      FOUNDER_COURSES.length > 0
        ? Math.round(
            FOUNDER_COURSES.reduce(
              (sum, course) => sum + computeCoursePercentComplete(course, progressRows),
              0,
            ) / FOUNDER_COURSES.length,
          )
        : 0;

    const adminCourses = await listPublishedAdminCourses().catch(() => []);
    const adminCurriculumOutline = adminCourses.length
      ? `Admin-authored published courses:\n${adminCourses
          .slice(0, 12)
          .map((c) => `- ${c.title} (/founder/learning/courses/${c.id}): ${c.description}`)
          .join("\n")}`
      : null;

    const ctx = buildCatalogCoachContext({
      founderName,
      companyName,
      overallPercent,
      adminCurriculumOutline,
      gapBasedRecommendations,
    });
    const result = await runPersonalCoach({ message, ctx, history });

    return NextResponse.json({
      reply: result.reply,
      disclaimer: result.disclaimer ?? COACH_DISCLAIMER,
      mode: result.mode,
      openAiAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
    });
  }

  const resolved = resolveCoachLesson(courseSlug, lessonSlug);
  if (!resolved) {
    return NextResponse.json({ error: "Course or lesson not found." }, { status: 404 });
  }

  const ctx = buildPersonalCoachContext({
    course: resolved.course,
    lesson: resolved.lesson,
    sectionTitle: resolved.sectionTitle,
    founderName,
    companyName,
    progressRows,
    gapBasedRecommendations,
  });

  const result = await runPersonalCoach({ message, ctx, history });

  return NextResponse.json({
    reply: result.reply,
    disclaimer: result.disclaimer ?? COACH_DISCLAIMER,
    mode: result.mode,
    openAiAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
