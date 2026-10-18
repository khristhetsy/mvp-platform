import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSection, WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { COACH_COURSES } from "@/lib/learning/coach/courses";
import { buildReviewPack, reviewFingerprint } from "@/lib/learning/coach/review-pack";

export const dynamic = "force-dynamic";

/** Everything the coach says to founders for one course, in one place, for counsel to read. */
export default async function CoachReviewPackPage({ params }: Readonly<{ params: Promise<{ course: string }> }>) {
  const profile = await requireRole(["admin", "analyst"]);
  const { course: slug } = await params;
  const course = COACH_COURSES.find((c) => c.slug === slug);
  if (!course) notFound();

  const pack = buildReviewPack(course);
  const fingerprint = reviewFingerprint(pack);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Counsel review pack"
          title={course.title}
          description="Every word the AI IR Coach shows or sends to founders for this course. Print this page or save it as a PDF for counsel."
          actions={
            <Link href="/admin/learning/coach" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ← AI IR Coach
            </Link>
          }
        />

        <p className="break-all rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Fingerprint of this wording: <span className="font-mono">{fingerprint}</span>. A review applies only to this exact wording.
        </p>

        <PageSection title="What the AI is told" subtitle="Rules given to the AI coach, for each coaching style, on top of the platform's standing guardrails.">
          <div className="space-y-4">
            {pack.aiRules.map((r) => (
              <div key={r.tone} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{r.tone}</p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.text}</pre>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Disclaimer shown with coach answers</p>
              <p className="mt-2 text-sm text-slate-700">{pack.disclaimer}</p>
            </div>
          </div>
        </PageSection>

        <PageSection title="Coaching styles" subtitle="The lines founders see in each style.">
          <div className="space-y-4">
            {pack.styles.map((s) => (
              <div key={s.tone} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                <p className="text-xs text-slate-500">{s.blurb}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {Object.entries(s.lines).map(([key, line]) => (
                    <li key={key}>
                      <span className="text-xs text-slate-400">{key.replace(/_/g, " ")}: </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection title="Reminders and nudges" subtitle="In app and email messages, in each style.">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">Style</th>
                  <th className="px-5 py-3">Message</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Text</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pack.reminders.map((r) => (
                  <tr key={`${r.tone}-${r.kind}`}>
                    <td className="px-5 py-3 text-xs capitalize text-slate-500">{r.tone}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{r.kind}</td>
                    <td className="px-5 py-3 text-slate-900">{r.title}</td>
                    <td className="px-5 py-3 text-slate-700">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection title="Email footer" subtitle="Shown at the bottom of every coach email.">
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            {pack.emailFooter.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </PageSection>

        <PageSection title="Course text" subtitle="Lessons and the coach steps founders follow.">
          <div className="space-y-6">
            {pack.course.sections.map((section) => (
              <div key={section.slug}>
                <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                <div className="mt-3 space-y-4">
                  {section.lessons.map((lesson) => (
                    <div key={lesson.slug} className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">{lesson.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{lesson.content}</p>
                      {lesson.keyPoints?.length ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {lesson.keyPoints.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      ) : null}
                      {lesson.steps?.length ? (
                        <ol className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
                          {lesson.steps.map((step, i) => (
                            <li key={step.title}>
                              <p className="font-medium text-slate-900">
                                {i + 1}. {step.title}
                              </p>
                              <p>{step.instruction}</p>
                              {step.commonMistake ? <p className="text-xs text-slate-500">Common mistake: {step.commonMistake}</p> : null}
                              {step.example ? <p className="text-xs text-slate-500">Example: {step.example}</p> : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PageSection>
      </WorkspacePageContainer>
    </AppShell>
  );
}
