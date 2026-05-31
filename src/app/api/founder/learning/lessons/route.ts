import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { findCourseLesson, getCourseBySlug } from "@/lib/learning/courses";
import { decodeLessonKey } from "@/lib/learning/lesson-keys";
import { enrichLesson } from "@/lib/learning/lesson-enrichment";
import { completeLesson, recordQuizAttempt } from "@/lib/learning/lesson-progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getModuleContent } from "@/lib/learning/modules";
import { getLearningModuleBySlug } from "@/lib/learning/progress";

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug : null;
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug : null;

  if (courseSlug && lessonSlug) {
    const course = getCourseBySlug(courseSlug);
    const found = course ? findCourseLesson(course, lessonSlug) : null;
    if (!course || !found) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    const lesson = found.lesson;

    try {
      if (body.action === "quiz") {
        const answers = (body.answers ?? {}) as Record<string, string>;
        const questions = lesson.quiz?.questions ?? [];
        if (questions.length === 0) {
          return NextResponse.json({ error: "No quiz for this lesson." }, { status: 400 });
        }

        let correct = 0;
        for (const q of questions) {
          if (answers[q.id] === q.correctChoiceId) correct += 1;
        }
        const score = Math.round((correct / questions.length) * 100);
        const passing = lesson.quiz?.passingScore ?? 70;
        const passed = score >= passing;

        await recordQuizAttempt({
          founderId: auth.profile.id,
          companyId: company.id,
          moduleSlug: courseSlug,
          lessonId: lessonSlug,
          score,
          passed,
          answers,
        });

        return NextResponse.json({ score, passed, passingScore: passing });
      }

      if (body.action === "complete") {
        await completeLesson({
          founderId: auth.profile.id,
          companyId: company.id,
          moduleSlug: courseSlug,
          lessonId: lessonSlug,
          quizPassed: body.quizPassed === true,
          quizScore: typeof body.quizScore === "number" ? body.quizScore : null,
        });
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save lesson progress.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const lessonKey = typeof body.lessonKey === "string" ? body.lessonKey : null;
  const decoded = lessonKey ? decodeLessonKey(lessonKey) : null;

  if (!decoded) {
    return NextResponse.json({ error: "Invalid lesson reference." }, { status: 400 });
  }

  const content = getModuleContent(decoded.moduleSlug);
  const moduleRecord = await getLearningModuleBySlug(decoded.moduleSlug);
  if (!content || !moduleRecord) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const rawLesson = content.lessons.find((l) => l.id === decoded.lessonId);
  if (!rawLesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const lessonIndex = content.lessons.findIndex((l) => l.id === decoded.lessonId);
  const lesson = enrichLesson(rawLesson, moduleRecord, lessonIndex);

  try {
    if (body.action === "quiz") {
      const answers = (body.answers ?? {}) as Record<string, string>;
      const questions = lesson.quiz?.questions ?? [];
      if (questions.length === 0) {
        return NextResponse.json({ error: "No quiz for this lesson." }, { status: 400 });
      }

      let correct = 0;
      for (const q of questions) {
        if (answers[q.id] === q.correctChoiceId) correct += 1;
      }
      const score = Math.round((correct / questions.length) * 100);
      const passing = lesson.quiz?.passingScore ?? 70;
      const passed = score >= passing;

      await recordQuizAttempt({
        founderId: auth.profile.id,
        companyId: company.id,
        moduleSlug: decoded.moduleSlug,
        lessonId: decoded.lessonId,
        score,
        passed,
        answers,
      });

      return NextResponse.json({ score, passed, passingScore: passing });
    }

    if (body.action === "complete") {
      await completeLesson({
        founderId: auth.profile.id,
        companyId: company.id,
        moduleSlug: decoded.moduleSlug,
        lessonId: decoded.lessonId,
        quizPassed: body.quizPassed === true,
        quizScore: typeof body.quizScore === "number" ? body.quizScore : null,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save lesson progress.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
