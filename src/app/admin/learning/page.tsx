import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrainingBanner } from "@/components/training/TrainingBanner";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadLearningDashboard, recordRows } from "@/lib/learning/dashboard";
import { DetailRow, DetailTr } from "@/components/admin/learning/DashboardDetail";
import { AdminLearningAtRisk } from "@/components/admin/learning/AdminLearningAtRisk";
import { WorkspaceModulePlaceholder } from "@/components/ui/WorkspaceModulePlaceholder";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";
import { CAPITAL_STAGE_MODULES, CAPITAL_STAGE_META, type CapitalStage } from "@/lib/learning/capital-stages";

export const dynamic = "force-dynamic";

const TONE_DOT: Record<string, string> = { bad: "bg-red-500", warn: "bg-amber-500", info: "bg-[#1A6CE4]" };

export default async function AdminLearningDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const t = await getTranslations("learnAdmin");
  if (isAdminModuleComingSoon("learning")) {
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
            eyebrow={t("eyebrowOps")}
            title={t("homeTitle")}
            description={t("homeDesc")}
          />
          <WorkspaceModulePlaceholder title="E-learning admin" />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

  const supabase = createServiceRoleClient();

  // Fetch all DB learning_programs slugs (any status) to detect which static modules are linked
  type SlimProgram = { id: string; slug: string; title: string; content_status: string };
  const { data: rawPrograms } = await supabase
    .from("learning_programs")
    .select("id, slug, title, content_status")
    .limit(500);
  const allPrograms = (rawPrograms ?? []) as SlimProgram[];
  const programBySlug = new Map(allPrograms.map((p) => [p.slug, p]));

  const d = await loadLearningDashboard(supabase);
  const tot = d.totals;

  const nav = [
    { href: "/admin/learning/courses", label: "Courses" },
    { href: "/admin/learning/approvals", label: "Approvals" },
    { href: "/admin/learning/certificates", label: "Certificates" },
    { href: "/admin/learning/analytics", label: "Analytics" },
  ];

  const stageColors: Record<string, { bg: string; text: string }> = {
    stage_0: { bg: "#EFF6FF", text: "#1D4ED8" },
    stage_1: { bg: "#F0FDF4", text: "#15803D" },
    stage_2: { bg: "#FFF7ED", text: "#C2410C" },
    stage_3: { bg: "#FAF5FF", text: "#7E22CE" },
  };

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
          eyebrow={t("eyebrowOps")}
          title={t("homeTitle")}
          description={t("homeDescLong")}
          metadata="Staff only · curriculum approvals & progress analytics"
          actions={
            <div className="flex flex-wrap gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          }
        />

        <TrainingBanner userId={profile.id} email={profile.email} />

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <MetricCard
            label="Published courses"
            value={String(tot.coursesPublished)}
            unit={`of ${tot.coursesTotal} total`}
            detail={`${tot.coursesDraft} draft, ${tot.pendingReview} pending review`}
            accent="blue"
            ring={{ percent: d.publishedPercent, center: String(tot.coursesPublished), pending: tot.coursesTotal === 0 }}
            flag={null}
            audience="admin"
            detailPanel={{
              breakdown: [
                { label: "Published", value: String(tot.coursesPublished) },
                { label: "Draft", value: String(tot.coursesDraft) },
                { label: "Pending review", value: String(tot.pendingReview) },
                ...recordRows(d.records.courses),
              ],
              href: "/admin/learning/courses",
              hrefLabel: "All courses",
            }}
          />
          <MetricCard
            label="Enrolled founders"
            value={String(tot.enrolledFounders)}
            unit="enrolled"
            detail={`${tot.lessonCompletions} lessons completed`}
            accent="slate"
            ring={{ percent: null, center: String(tot.enrolledFounders), pending: true }}
            flag={null}
            audience="admin"
            detailPanel={{
              breakdown: [
                { label: "Enrolled founders", value: String(tot.enrolledFounders) },
                { label: "Lesson completions", value: String(tot.lessonCompletions) },
                ...recordRows(d.records.founders, "No founders enrolled yet."),
              ],
              href: "/admin/learning/founders",
              hrefLabel: "Founder roster",
            }}
          />
          <MetricCard
            label="Quiz attempts"
            value={String(tot.quizAttempts)}
            unit="attempts"
            detail="Across all courses"
            accent="violet"
            ring={{ percent: null, center: String(tot.quizAttempts), pending: true }}
            flag={tot.lessonCompletions > 0 && tot.quizAttempts === 0 ? { text: "Lessons done, no quiz started", tone: "warn" } : null}
            audience="admin"
            detailPanel={{
              note: "Counts every row in founder quiz attempts. There is no ceiling to measure against, so the ring is dashed.",
              breakdown: recordRows(d.records.quizzes, "No quiz attempts yet."),
              href: "/admin/learning/analytics",
              hrefLabel: "Analytics",
            }}
          />
          <MetricCard
            label="Certificates"
            value={String(tot.certificates)}
            unit="issued"
            detail="Certificate of Completion"
            accent="slate"
            ring={{ percent: null, center: String(tot.certificates), pending: true }}
            flag={null}
            audience="admin"
            detailPanel={{
              note: "Certificates of Completion only. No regulatory or qualification claims.",
              breakdown: recordRows(d.records.certificates, "No certificates issued yet."),
              href: "/admin/learning/certificates",
              hrefLabel: "Certificates",
            }}
          />
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
        <section>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Capital stage modules</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      13 built-in static modules — link an admin course to enrich with video &amp; custom content
                    </p>
                  </div>
                  <Link
                    href="/admin/learning/courses/new"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    + New course
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="px-6 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Module</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Stage</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lessons</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">DB linked</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {CAPITAL_STAGE_MODULES.map((mod) => {
                        const linked = programBySlug.get(mod.slug);
                        const stageMeta = CAPITAL_STAGE_META[mod.stage as CapitalStage];
                        const sc = stageColors[mod.stage] ?? { bg: "#F1F5F9", text: "#475569" };
                        // Encode pre-fill params for the new course form
                        const createParams = new URLSearchParams({
                          slug: mod.slug,
                          stage: mod.stage,
                          title: mod.title,
                        });
                        return (
                          <DetailTr
                        key={mod.slug}
                        label={mod.title}
                        value={String(mod.lessons.length)}
                        unit={`lesson${mod.lessons.length === 1 ? "" : "s"}, ${stageMeta.label.split(" — ")[0]}`}
                        detail={linked ? `Linked course: ${linked.title}, ${linked.content_status}.` : "Not linked to a course yet."}
                        extra={{
                          breakdown: [
                            { label: "Stage", value: stageMeta.label.split(" — ")[0] },
                            { label: "Lessons", value: String(mod.lessons.length) },
                            { label: "Linked course", value: linked ? linked.title : "Unlinked" },
                          ],
                          href: linked ? `/admin/learning/courses/${linked.id}` : `/admin/learning/courses/new?${createParams}`,
                          hrefLabel: linked ? "Edit course" : "Create & link",
                        }}
                        className="cursor-pointer transition hover:bg-slate-50"
                      >
                            <td className="px-6 py-3">
                              <p className="font-medium text-slate-800">{mod.title}</p>
                              <code className="text-[10px] text-slate-400">{mod.slug}</code>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: sc.bg, color: sc.text }}
                              >
                                {stageMeta.label.split(" — ")[0]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{mod.lessons.length}</td>
                            <td className="px-4 py-3">
                              {linked ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                                  <span className="text-xs font-medium text-green-700">
                                    {linked.content_status === "published" ? "Published" : linked.content_status}
                                  </span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
                                  <span className="text-xs text-slate-400">Unlinked</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {linked ? (
                                <Link
                                  href={`/admin/learning/courses/${linked.id}`}
                                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                                >
                                  Edit course
                                </Link>
                              ) : (
                                <Link
                                  href={`/admin/learning/courses/new?${createParams}`}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition"
                                >
                                  Create &amp; link
                                </Link>
                              )}
                            </td>
                          </DetailTr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 px-6 py-3">
                  <p className="text-[11px] text-slate-400">
                    To link: create a course and set its <strong>slug</strong> to match the module slug above.
                    Linked courses can add video, custom lessons, and modules — all visible on the founder lesson page.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--navy)]">Founder progress</h2>
                <Link href="/admin/learning/analytics" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Analytics</Link>
              </div>
              {(
                [
                  ["Enrolled founders", tot.enrolledFounders, d.records.founders, "Enrolled founders", "/admin/learning/founders", "Founder roster", "No founders enrolled yet."],
                  ["Lessons completed", tot.lessonCompletions, d.records.lessons, "Latest completions", "/admin/learning/founders", "Founder roster", "No lessons completed yet."],
                  ["Quiz attempts", tot.quizAttempts, d.records.quizzes, "Latest attempts", "/admin/learning/analytics", "Analytics", "No quiz attempts yet."],
                  ["Certificates issued", tot.certificates, d.records.certificates, "Latest certificates", "/admin/learning/certificates", "Certificates", "No certificates issued yet."],
                ] as const
              ).map(([label, n, records, recordsTitle, href, hrefLabel, recordsEmpty]) => (
                <DetailRow
                  key={label}
                  label={label}
                  value={String(n)}
                  detail={recordsTitle}
                  extra={{ breakdown: recordRows([...records], recordsEmpty), href, hrefLabel }}
                  className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-sm first:border-t-0 hover:bg-slate-50"
                >
                  <span className="text-slate-700">{label}</span>
                  <span className="font-bold text-[var(--navy)]">{n}</span>
                </DetailRow>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm">
                <span className="text-slate-700">Founders by capital stage</span>
                <span className="text-slate-400">Not measured</span>
              </div>
              <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                Source: learning progress, lesson progress, quiz attempts and certificates, read when the page loaded.
              </p>
            </section>

            <AdminLearningAtRisk />
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--navy)]">Needs attention</h2>
                <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">{d.attention.length}</span>
              </div>
              {d.attention.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing needs attention.</p>
              ) : (
                d.attention.map((a) => (
                  <DetailRow
                    key={a.text}
                    label="Needs attention"
                    value={a.text.split(" ")[0]}
                    detail={a.text}
                    extra={{
                      breakdown: recordRows(a.text.includes("lesson") ? d.records.lessons : a.text.includes("review") ? d.records.courses.filter((c) => c.sub === "pending_review") : d.records.courses.filter((c) => c.sub === "draft")),
                      href: a.text.includes("lesson") ? "/admin/learning/analytics" : "/admin/learning/approvals",
                      hrefLabel: a.text.includes("lesson") ? "Analytics" : "Approvals",
                    }}
                    className="flex w-full gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm first:border-t-0 hover:bg-slate-50"
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${TONE_DOT[a.tone]}`} />
                    <span className="text-slate-700">{a.text}</span>
                  </DetailRow>
                ))
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--navy)]">Course approvals</h2>
                <Link href="/admin/learning/approvals" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Approvals</Link>
              </div>
              {(
                [
                  ["Draft", tot.coursesDraft, "No drafts."],
                  ["Pending review", tot.pendingReview, "Approval queue is clear."],
                  ["Published", tot.coursesPublished, "No published courses."],
                ] as const
              ).map(([label, n, empty]) => (
                <DetailRow
                  key={label}
                  label={label}
                  value={String(n)}
                  unit="courses"
                  extra={{
                    breakdown: recordRows(d.records.courses.filter((c) => (label === "Published" ? c.sub === "published" || c.sub === "approved" : c.sub === (label === "Draft" ? "draft" : "pending_review"))), empty),
                    href: "/admin/learning/approvals",
                    hrefLabel: "Approvals",
                  }}
                  className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-sm first:border-t-0 hover:bg-slate-50"
                >
                  <span className="text-slate-700">{label}</span>
                  <span className="font-bold text-[var(--navy)]">{n}</span>
                </DetailRow>
              ))}
              <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Source: courses, by content status.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--navy)]">Coach</h2>
                <div className="flex gap-2">
                  <Link href="/admin/learning/coach" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">AI IR Coach</Link>
                  <Link href="/admin/learning/founders" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Founder roster</Link>
                </div>
              </div>
              {d.coached.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No coached course yet.</p>
              ) : (
                d.coached.map((c) => (
                  <div key={c.slug} className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0">
                    <span className="text-slate-700">{c.title}</span>
                    <span className="font-bold text-[var(--navy)]">{c.lessons} lessons</span>
                  </div>
                ))
              )}
            </section>
          </div>
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}

