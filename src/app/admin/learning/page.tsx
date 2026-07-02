import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AdminLearningAtRisk } from "@/components/admin/learning/AdminLearningAtRisk";
import { WorkspaceModulePlaceholder } from "@/components/ui/WorkspaceModulePlaceholder";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";
import { CAPITAL_STAGE_MODULES, CAPITAL_STAGE_META, type CapitalStage } from "@/lib/learning/capital-stages";

export const dynamic = "force-dynamic";

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

  const [
    coursesTotal,
    coursesPublished,
    coursesDraft,
    lessonCompletions,
    quizAttempts,
    pendingApprovals,
    certificatesIssued,
    foundersEnrolled,
  ] = await Promise.all([
    supabase.from("learning_programs").select("id", { count: "exact", head: true }),
    supabase.from("learning_programs").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("learning_programs").select("id", { count: "exact", head: true }).eq("content_status", "draft"),
    supabase
      .from("founder_lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("founder_quiz_attempts").select("id", { count: "exact", head: true }),
    supabase
      .from("learning_programs")
      .select("id", { count: "exact", head: true })
      .eq("content_status", "pending_review"),
    supabase.from("learning_certificates").select("id", { count: "exact", head: true }),
    supabase.from("learning_progress").select("founder_id", { count: "exact", head: true }),
  ]);

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

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total courses" value={String(coursesTotal.count ?? 0)} detail="learning_programs" accent="indigo" href="/admin/learning/courses" />
          <MetricCard label="Published courses" value={String(coursesPublished.count ?? 0)} detail="Visible to founders" accent="violet" href="/admin/learning/courses" />
          <MetricCard label="Draft courses" value={String(coursesDraft.count ?? 0)} detail="Not published" accent="blue" href="/admin/learning/courses" />
          <MetricCard label="Pending approvals" value={String(pendingApprovals.count ?? 0)} detail="Awaiting review" accent="slate" href="/admin/learning/approvals" />
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Enrolled founders" value={String(foundersEnrolled.count ?? 0)} detail="learning_progress" accent="indigo" href="/admin/learning/analytics" />
          <MetricCard label="Lesson completions" value={String(lessonCompletions.count ?? 0)} detail="founder_lesson_progress" accent="violet" href="/admin/learning/analytics" />
          <MetricCard label="Quiz attempts" value={String(quizAttempts.count ?? 0)} detail="founder_quiz_attempts" accent="blue" href="/admin/learning/analytics" />
          <MetricCard label="Certificates issued" value={String(certificatesIssued.count ?? 0)} detail="Certificate of Completion" accent="slate" href="/admin/learning/certificates" />
        </section>

        <section className="mt-8">
          <AdminLearningAtRisk />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Command center" subtitle="Phase 1 operational controls">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>
                Manage courses (programs), module assignments, lesson drafts, and quiz definitions.
              </li>
              <li>
                Approval workflow: draft → pending_review → approved → published → archived.
              </li>
              <li>
                Certificates are &quot;Certificate of Completion&quot; only. No regulatory or qualification claims.
              </li>
            </ul>
          </WorkspacePanel>
          <WorkspacePanel title="Privacy & safety" subtitle="Operational analytics only">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>No message bodies, private documents, tokens, or OAuth data shown here.</li>
              <li>Founder-facing learning experience remains unchanged in Phase 1.</li>
            </ul>
          </WorkspacePanel>
        </section>

        {/* Capital stage modules panel */}
        <section className="mt-8">
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
                      <tr key={mod.slug} className="hover:bg-slate-50 transition">
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
                      </tr>
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
      </WorkspacePageContainer>
    </AppShell>
  );
}

