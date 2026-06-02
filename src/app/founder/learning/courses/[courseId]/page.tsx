import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
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
    // sequential is fine at Phase 2 scale; avoids large fanout.
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

  const totalLessons = [...lessonsByModule.values()].reduce((sum, list) => sum + list.length, 0);
  const completedLessons = [...lessonsByModule.entries()].reduce((sum, [moduleSlug, list]) => {
    return sum + list.filter((l) => completedSet.has(`${moduleSlug}:${l.lesson_key}`)).length;
  }, 0);
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name}>
      <FounderFeatureGate featureKey="elearning">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Admin-authored course"
            title={course.title}
            description={course.description}
            metadata={`Educational content only · ${percent}% lessons complete`}
            actions={
              <Link
                href="/founder/learning"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to learning
              </Link>
            }
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Educational content only. No investment, legal, or tax advice. No guarantee of funding outcomes.
          </div>

          {quiz ? (
            <WorkspacePanel title="Course quiz" subtitle="Optional if present; required for certificate if published">
              <p className="text-sm text-slate-700">{quiz.title}</p>
              <Link
                href={`/founder/learning/courses/${courseId}/quiz`}
                className="mt-3 inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Take quiz
              </Link>
            </WorkspacePanel>
          ) : null}

          <WorkspacePanel title="Modules" subtitle={`${modules.length} modules · ${totalLessons} lessons`}>
            {modules.length === 0 ? (
              <p className="text-sm text-slate-600">No published modules are linked to this course yet.</p>
            ) : (
              <div className="space-y-4">
                {modules.map((m) => {
                  const lessons = lessonsByModule.get(m.slug) ?? [];
                  return (
                    <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{m.category}</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">{m.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                      <div className="mt-3 space-y-2">
                        {lessons.length === 0 ? (
                          <p className="text-xs text-slate-500">No published lessons yet.</p>
                        ) : (
                          lessons.map((l, idx) => {
                            const done = completedSet.has(`${m.slug}:${l.lesson_key}`);
                            return (
                              <Link
                                key={l.id}
                                href={`/founder/learning/courses/${courseId}/lessons/${l.id}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                              >
                                <span className="min-w-0 truncate">
                                  Lesson {idx + 1}: {l.title}
                                </span>
                                <span className={`text-xs font-semibold ${done ? "text-emerald-700" : "text-slate-600"}`}>
                                  {done ? "Completed" : "Open"}
                                </span>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Progress & certificates" subtitle="Certificate of Completion only">
            <p className="text-sm text-slate-700">
              Course status: <span className="font-semibold">{courseProgress?.status ?? "not_started"}</span>
            </p>
            {(certificates ?? []).length ? (
              <div className="mt-3 space-y-2">
                {(certificates ?? []).map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-900">{c.certificate_title}</p>
                    <p className="text-xs text-slate-500">
                      Code: <span className="font-mono">{c.certificate_code}</span> · status: {c.status}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No certificate issued yet.</p>
            )}
          </WorkspacePanel>
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}

