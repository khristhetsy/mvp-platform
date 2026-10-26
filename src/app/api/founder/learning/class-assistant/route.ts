import { NextResponse } from "next/server";
import { gateAiRun } from "@/lib/ai-usage/gate";
import { isClaudeConfigured } from "@/lib/claude";
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
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachCourse, getCoachLesson } from "@/lib/learning/coach/courses";
import { buildCoachPromptAddendum } from "@/lib/learning/coach/ir-coach";
import { formatSnapshotForPrompt } from "@/lib/learning/coach/data-reads";
import { loadCoachSnapshot } from "@/lib/learning/coach/snapshot-loader";
import { buildOnboardingCoachContext } from "@/lib/learning/onboarding-coach";
import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";

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

  const { company } = await getActiveCompanyForUser(auth.profile);
  const [progressRows, gapBasedRecommendations] = company
    ? await Promise.all([
        listLessonProgressForCompany(auth.profile.id, company.id),
        getAICoachRecommendations(auth.profile.id, company.id),
      ])
    : [[], []];

  const founderName = auth.profile.full_name ?? auth.profile.email ?? "Founder";
  const companyName = company?.company_name ?? null;

  // Onboarding mode: the coach on /founder/onboarding. Read only, nothing is saved for the founder.
  if (body.surface === "onboarding") {
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const { data: documents } = await listCompanyDocuments(auth.supabase, company.id);
    const { data: diligenceReport } = await getLatestDiligenceReport(auth.supabase, company.id);
    const progress = computeFounderOnboardingProgress({
      company,
      documents: documents ?? [],
      diligenceReportExists: Boolean(diligenceReport),
      storedStepState: company.onboarding_step_state,
    });
    const ctx = buildOnboardingCoachContext({ founderName, companyName, progress });
    const aiRun = await gateAiRun(auth.profile.id, "class_assistant");
    if (aiRun.blocked) return aiRun.blocked;
    const result = await runPersonalCoach({ message, ctx, history });
    await aiRun.done();
    return NextResponse.json({
      reply: result.reply,
      disclaimer: result.disclaimer ?? COACH_DISCLAIMER,
      mode: result.mode,
      claudeAvailable: isClaudeConfigured(),
    });
  }

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
    // Per-plan run cap (Admin, Feature Controls, AI usage limits).
    const aiRun = await gateAiRun(auth.profile.id, "class_assistant");
    if (aiRun.blocked) return aiRun.blocked;
    const result = await runPersonalCoach({ message, ctx, history });
    await aiRun.done();

    return NextResponse.json({
      reply: result.reply,
      disclaimer: result.disclaimer ?? COACH_DISCLAIMER,
      mode: result.mode,
      claudeAvailable: isClaudeConfigured(),
    });
  }

  // Coach format courses are not in the public catalog. They resolve only while the AI IR Coach
  // is active for this founder, and the coach style rides along on the same prompt.
  let resolved = resolveCoachLesson(courseSlug, lessonSlug);
  let coachAddendum: string | null = null;
  let coachTone: Awaited<ReturnType<typeof getCoachAccess>>["tone"] | null = null;
  if (getCoachCourse(courseSlug) || resolved) {
    const access = await getCoachAccess(auth.supabase as unknown as SupabaseClient, {
      founderId: auth.profile.id,
      companyId: company?.id ?? null,
      courseSlug,
    });
    if (access.active) {
      const coachLesson = lessonSlug ? getCoachLesson(courseSlug, lessonSlug) : null;
      const stepIndex = typeof body.stepIndex === "number" && Number.isInteger(body.stepIndex) ? body.stepIndex : 0;
      coachAddendum = buildCoachPromptAddendum({
        tone: access.tone,
        step: coachLesson?.steps[stepIndex] ?? null,
        lessonTitle: coachLesson?.lesson.title ?? null,
      });
      coachTone = access.tone;
      // Real data reads: the coach sees the founder's own rating, fix list, outreach, calendar and
      // progress, and is told which of them are empty or could not be read.
      const coachCourse = getCoachCourse(courseSlug);
      if (coachCourse) {
        const snapshot = await loadCoachSnapshot({
          supabase: auth.supabase,
          founderId: auth.profile.id,
          companyId: company?.id ?? null,
          course: coachCourse,
        });
        coachAddendum = `${coachAddendum}\n${formatSnapshotForPrompt(snapshot)}`;
      }
      if (!resolved) {
        const course = getCoachCourse(courseSlug);
        const lesson = coachLesson?.lesson ?? null;
        const section = course?.sections.find((s) => s.lessons.some((l) => l.slug === lessonSlug)) ?? null;
        if (course) resolved = { course, lesson, sectionTitle: section?.title ?? null };
      }
    }
  }
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
  ctx.coachAddendum = coachAddendum;
  ctx.coachTone = coachTone;

  // Per-plan run cap (Admin, Feature Controls, AI usage limits).
  const aiRun = await gateAiRun(auth.profile.id, "class_assistant");
  if (aiRun.blocked) return aiRun.blocked;
  const result = await runPersonalCoach({ message, ctx, history });
  await aiRun.done();

  return NextResponse.json({
    reply: result.reply,
    disclaimer: result.disclaimer ?? COACH_DISCLAIMER,
    mode: result.mode,
    claudeAvailable: isClaudeConfigured(),
  });
}
