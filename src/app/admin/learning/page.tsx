import Link from "next/link";
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

export const dynamic = "force-dynamic";

export default async function AdminLearningDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);

  if (isAdminModuleComingSoon("learning")) {
    return (
      <AppShell
        role="ADMIN"
        workspace="admin"
        profileName={profile.full_name ?? profile.email ?? "Admin"}
        profileSubtitle={profile.role}
      >
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Learning operations"
            title="Admin Learning"
            description="Educational content only. No investment, legal, or tax advice."
          />
          <WorkspaceModulePlaceholder title="E-learning admin" />
        </WorkspacePageContainer>
      </AppShell>
    );
  }

  const supabase = createServiceRoleClient();

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

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Learning operations"
          title="Admin Learning"
          description="Educational content only. No investment, legal, or tax advice. No guarantee of funding outcomes."
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
                Certificates are “Certificate of Completion” only. No regulatory or qualification claims.
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
      </WorkspacePageContainer>
    </AppShell>
  );
}

