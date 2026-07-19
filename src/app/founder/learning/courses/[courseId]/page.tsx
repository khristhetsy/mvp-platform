import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getPublishedAdminCourse, getPublishedCourseQuiz, listPublishedAdminCourseModules, listPublishedAdminLessonsForModule } from "@/lib/learning/admin-courses";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function FounderAdminCoursePage({ params }: PageProps) {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { courseId } = await params;
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) notFound();

  const course = await getPublishedAdminCourse(courseId);
  if (!course) notFound();

  const [modules, quiz] = await Promise.all([
    listPublishedAdminCourseModules(courseId),
    getPublishedCourseQuiz(courseId),
  ]);

  const lessonsByModule = new Map<string, Awaited<ReturnType<typeof listPublishedAdminLessonsForModule>>>();
  for (const m of modules) {
    lessonsByModule.set(m.slug, await listPublishedAdminLessonsForModule(m.slug));
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: lessonProgress }, { data: courseProgress }, { data: certificates }] = await Promise.all([
    supabase
      .from("founder_lesson_progress")
      .select("module_slug, lesson_id, status, quiz_passed, quiz_score, completed_at")
      .eq("company_id", company.id)
      .eq("founder_id", profile.id)
      .limit(1000),
    supabase
      .from("learning_course_progress")
      .select("status, started_at, completed_at, last_viewed_at")
      .eq("company_id", company.id)
      .eq("founder_id", profile.id)
      .eq("program_id", courseId)
      .maybeSingle(),
    supabase
      .from("learning_certificates")
      .select("id, certificate_title, certificate_code, status, issued_at")
      .eq("founder_id", profile.id)
      .eq("program_id", courseId)
      .order("issued_at", { ascending: false })
      .limit(5),
  ]);

  const completedSet = new Set(
    (lessonProgress ?? [])
      .filter((r) => r.status === "completed")
      .map((r) => `${r.module_slug}:${r.lesson_id}`),
  );

  // Best attempt on the course-completion quiz (gates completion at 80%).
  const { data: quizAttempts } = quiz
    ? await supabase
        .from("founder_quiz_attempts")
        .select("score, passed")
        .eq("company_id", company.id)
        .eq("founder_id", profile.id)
        .eq("module_slug", `course:${courseId}`)
        .eq("lesson_id", `quiz:${quiz.id}`)
        .order("score", { ascending: false })
        .limit(1)
    : { data: null };
  const bestQuiz = quizAttempts?.[0] ?? null;
  const quizPassed = Boolean(bestQuiz?.passed);

  const totalLessons = [...lessonsByModule.values()].reduce((sum, list) => sum + list.length, 0);
  const completedLessons = [...lessonsByModule.entries()].reduce((sum, [moduleSlug, list]) => {
    return sum + list.filter((l) => completedSet.has(`${moduleSlug}:${l.lesson_key}`)).length;
  }, 0);
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Find first incomplete lesson to continue
  let firstLessonId: string | null = null;
  outer: for (const m of modules) {
    const lessons = lessonsByModule.get(m.slug) ?? [];
    for (const l of lessons) {
      if (!completedSet.has(`${m.slug}:${l.lesson_key}`)) {
        firstLessonId = l.id;
        break outer;
      }
    }
  }
  // Fallback: first lesson overall
  if (!firstLessonId) {
    for (const m of modules) {
      const lessons = lessonsByModule.get(m.slug) ?? [];
      if (lessons[0]) { firstLessonId = lessons[0].id; break; }
    }
  }

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name}>
      <FounderFeatureGate featureKey="elearning">
        <div className="space-y-8">

          {/* Hero banner */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-slate-900 p-8 text-white">
            <Link href="/founder/learning" className="text-xs font-medium text-white/80 hover:text-white">
              ← Course catalog
            </Link>
            <p className="mt-4 text-xs uppercase tracking-wide text-white/70">
              {course.category ?? "Course"} · {course.difficulty ?? "All levels"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{course.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/90">{course.description}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/80">
              <span>{totalLessons} lessons</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {firstLessonId ? (
                <Link
                  href={`/founder/learning/courses/${courseId}/lessons/${firstLessonId}`}
                  className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  {percent > 0 ? "Continue course" : "Start course"}
                </Link>
              ) : null}
              {quiz ? (
                <Link
                  href={`/founder/learning/courses/${courseId}/quiz`}
                  className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Take quiz
                </Link>
              ) : null}
              <span className="text-sm text-white/90">{percent}% complete</span>
            </div>
            {totalLessons > 0 ? (
              <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
              </div>
            ) : null}
          </div>

          {/* Completion gate */}
          {quiz ? (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 ${
                quizPassed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${quizPassed ? "text-emerald-800" : "text-amber-900"}`}>
                  {quizPassed ? "✓ Final quiz passed" : "🔒 Final quiz required to complete"}
                </p>
                <p className={`mt-0.5 text-xs ${quizPassed ? "text-emerald-700" : "text-amber-700"}`}>
                  {quizPassed
                    ? `You scored ${bestQuiz?.score ?? 0}%. Finish any remaining lessons to earn your certificate.`
                    : `Complete the lessons, then pass the final quiz (80% to pass, unlimited retries) to complete this course.${
                        bestQuiz ? ` Best score so far: ${bestQuiz.score}%.` : ""
                      }`}
                </p>
              </div>
              <Link
                href={`/founder/learning/courses/${courseId}/quiz`}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  quizPassed
                    ? "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                    : "bg-amber-600 text-white hover:bg-amber-700"
                }`}
              >
                {quizPassed ? "Review quiz" : bestQuiz ? "Retake quiz" : "Take final quiz"}
              </Link>
            </div>
          ) : null}

          {/* Curriculum */}
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{t("course_content")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("educational_content_only_not_legal_tax_or_inve")}</p>
            <div className="mt-4 space-y-4">
              {modules.length === 0 ? (
                <p className="text-sm text-slate-500">{t("no_published_modules_yet")}</p>
              ) : (
                modules.map((m) => {
                  const lessons = lessonsByModule.get(m.slug) ?? [];
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{m.category}</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-950">{m.title}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">{m.description}</p>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {lessons.length === 0 ? (
                          <li className="px-5 py-3 text-sm text-slate-400">No published lessons yet.</li>
                        ) : (
                          lessons.map((l, idx) => {
                            const done = completedSet.has(`${m.slug}:${l.lesson_key}`);
                            return (
                              <li key={l.id}>
                                <Link
                                  href={`/founder/learning/courses/${courseId}/lessons/${l.id}`}
                                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                                      {done ? "✓" : idx + 1}
                                    </span>
                                    <span className={`truncate ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                      {l.title}
                                    </span>
                                  </div>
                                  <span className="shrink-0 text-xs text-slate-400">{l.estimated_time_minutes}m</span>
                                </Link>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Certificates */}
          {(certificates ?? []).length > 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-sm font-semibold text-emerald-900">{t("certificate_of_completion")}</h2>
              {(certificates ?? []).map((c) => (
                <div key={c.id} className="mt-2">
                  <p className="font-semibold text-emerald-800">{c.certificate_title}</p>
                  <p className="text-xs text-emerald-600">Code: <span className="font-mono">{c.certificate_code}</span> · {c.status}</p>
                </div>
              ))}
            </div>
          ) : courseProgress?.status === "completed" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">{t("course_completed_no_certificate_issued_for_thi")}</p>
            </div>
          ) : null}

        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
