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
import { ExportModulesButton, StageFilter } from "@/components/admin/learning/ModulesControls";
import { AdminLearningAtRisk } from "@/components/admin/learning/AdminLearningAtRisk";
import { WorkspaceModulePlaceholder } from "@/components/ui/WorkspaceModulePlaceholder";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";
import { CAPITAL_STAGE_MODULES, CAPITAL_STAGE_META, type CapitalStage } from "@/lib/learning/capital-stages";

export const dynamic = "force-dynamic";

const TONE_DOT: Record<string, string> = { bad: "bg-red-500", warn: "bg-amber-500", info: "bg-[#1A6CE4]" };

export default async function AdminLearningDashboardPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
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

  const sp = await searchParams;
  const stageFilter = sp.stage && sp.stage in CAPITAL_STAGE_META ? (sp.stage as CapitalStage) : null;
  const modules = CAPITAL_STAGE_MODULES.filter((m) => !stageFilter || m.stage === stageFilter);
  const stageOptions = Object.entries(CAPITAL_STAGE_META).map(([value, meta]) => ({ value, label: meta.label.split(" — ")[0] }));
  const exportRows = modules.map((m) => {
    const linked = programBySlug.get(m.slug);
    return {
      module: m.title,
      slug: m.slug,
      stage: CAPITAL_STAGE_META[m.stage as CapitalStage].label.split(" — ")[0],
      lessons: m.lessons.length,
      linkedCourse: linked ? linked.title : "",
      status: linked ? linked.content_status : "unlinked",
    };
  });

  const quizGap = tot.lessonCompletions > 0 && tot.quizAttempts === 0;
  const approvalRows: { label: string; n: number; status: "Clear" | "Live" | "Needs work"; empty: string; records: typeof d.records.courses; href: string; hrefLabel: string }[] = [
    { label: "Draft courses", n: tot.coursesDraft, status: tot.coursesDraft > 0 ? "Needs work" : "Clear", empty: "No drafts.", records: d.records.courses.filter((c) => c.sub === "draft"), href: "/admin/learning/approvals", hrefLabel: "Approvals" },
    { label: "Pending review", n: tot.pendingReview, status: tot.pendingReview > 0 ? "Needs work" : "Clear", empty: "Approval queue is clear.", records: d.records.courses.filter((c) => c.sub === "pending_review"), href: "/admin/learning/approvals", hrefLabel: "Approvals" },
    { label: "Published courses", n: tot.coursesPublished, status: "Live", empty: "No published courses.", records: d.records.courses.filter((c) => c.sub === "published" || c.sub === "approved"), href: "/admin/learning/courses", hrefLabel: "All courses" },
  ];
  const PILL: Record<string, string> = {
    Clear: "bg-emerald-50 text-emerald-700",
    Live: "bg-[#eef3ff] text-[#1A6CE4]",
    "Needs work": "bg-amber-50 text-amber-700",
  };
  const approvalCount = approvalRows.length + (quizGap ? 1 : 0);

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
          title="Learning dashboard"
          description="One view across courses, founders, lessons, quizzes, certificates and approvals."
          metadata={`${t("homeDescLong")} Staff only`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StageFilter value={stageFilter ?? ""} options={stageOptions} />
              <ExportModulesButton rows={exportRows} />
              <Link
                href="/admin/learning/courses/new"
                className="rounded-xl bg-[#1A6CE4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2E78F5]"
              >
                New course
              </Link>
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

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--navy)]">Course approvals and follow up</h2>
                  <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">{approvalCount}</span>
                </div>
                <div className="flex gap-2">
                  <Link href="/admin/learning/courses" className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-[#1A6CE4]">All courses</Link>
                  <Link href="/admin/learning/approvals" className="rounded-full bg-[#1A6CE4] px-3 py-1 text-xs font-semibold text-white">Approvals</Link>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2.5">Queue</th>
                    <th className="px-4 py-2.5 text-right">Open</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvalRows.map((r) => (
                    <DetailTr
                      key={r.label}
                      label={r.label}
                      value={String(r.n)}
                      unit="courses"
                      extra={{ breakdown: recordRows(r.records, r.empty), href: r.href, hrefLabel: r.hrefLabel }}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-slate-800">{r.label}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{r.n}</td>
                      <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${PILL[r.status]}`}>{r.status}</span></td>
                    </DetailTr>
                  ))}
                  {quizGap ? (
                    <DetailTr
                      label="Lessons done, no quiz started"
                      value={String(tot.lessonCompletions)}
                      unit="lessons completed"
                      extra={{ breakdown: recordRows(d.records.lessons, "No lessons completed yet."), href: "/admin/learning/analytics", hrefLabel: "Analytics" }}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-slate-800">Lessons done, no quiz started</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{tot.lessonCompletions}</td>
                      <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${PILL["Needs work"]}`}>Needs work</span></td>
                    </DetailTr>
                  ) : null}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                Source: courses by content status, lesson progress and quiz attempts, read when the page loaded.
              </p>
            </section>

        <section>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Capital stage modules</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {stageFilter ? `${modules.length} of ${CAPITAL_STAGE_MODULES.length}` : CAPITAL_STAGE_MODULES.length} built-in static modules — link an admin course to enrich with video &amp; custom content
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
                      {modules.map((mod) => {
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
                                className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
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
                <h2 className="text-sm font-semibold text-[var(--navy)]">Courses by status</h2>
                <Link href="/admin/learning/courses" className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-[#1A6CE4]">Courses</Link>
              </div>
              {approvalRows.map((r) => (
                <DetailRow
                  key={r.label}
                  label={r.label}
                  value={String(r.n)}
                  unit="courses"
                  extra={{ breakdown: recordRows(r.records, r.empty), href: r.href, hrefLabel: r.hrefLabel }}
                  className="flex w-full items-center gap-4 border-t border-slate-100 px-4 py-3 text-left text-sm first:border-t-0 hover:bg-slate-50"
                >
                  <span className="w-24 shrink-0 text-slate-700 sm:w-32">{r.label.replace(" courses", "")}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-[#1A6CE4]" style={{ width: `${tot.coursesTotal > 0 ? Math.round((r.n / tot.coursesTotal) * 100) : 0}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right font-bold text-[var(--navy)]">{r.n}</span>
                </DetailRow>
              ))}
            </section>

            <AdminLearningAtRisk />
          </div>

          <div className="min-w-0 space-y-4">
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

