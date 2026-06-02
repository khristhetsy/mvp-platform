import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLearningAnalyticsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const [
    progressCount,
    completedProgress,
    completedLessons,
    quizAttempts,
    passedAttempts,
    certificatesIssued,
    incompleteFounders,
  ] = await Promise.all([
    supabase.from("learning_progress").select("id", { count: "exact", head: true }),
    supabase.from("learning_progress").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("founder_lesson_progress").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("founder_quiz_attempts").select("id", { count: "exact", head: true }),
    supabase.from("founder_quiz_attempts").select("id", { count: "exact", head: true }).eq("passed", true),
    supabase.from("learning_certificates").select("id", { count: "exact", head: true }),
    supabase
      .from("learning_progress")
      .select("founder_id", { count: "exact", head: true })
      .neq("status", "completed"),
  ]);

  const completionRate =
    progressCount.count && progressCount.count > 0
      ? Math.round(((completedProgress.count ?? 0) / progressCount.count) * 100)
      : 0;
  const quizPassRate =
    quizAttempts.count && quizAttempts.count > 0
      ? Math.round(((passedAttempts.count ?? 0) / quizAttempts.count) * 100)
      : 0;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin Learning"
          title="Analytics"
          description="Educational analytics only. No private documents, messages, or tokens."
          actions={
            <Link
              href="/admin/learning"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to dashboard
            </Link>
          }
        />

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Enrollments" value={String(progressCount.count ?? 0)} detail="learning_progress" accent="indigo" />
          <MetricCard
            label="Completion rate"
            value={`${completionRate}%`}
            detail={`${completedProgress.count ?? 0} completed / ${progressCount.count ?? 0} progress rows`}
            accent="violet"
          />
          <MetricCard label="Quiz pass rate" value={`${quizPassRate}%`} detail="passed attempts / total attempts" accent="blue" />
          <MetricCard
            label="Incomplete founders"
            value={String(incompleteFounders.count ?? 0)}
            detail="Distinct founders with unfinished progress"
            accent="slate"
          />
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Lesson completions"
            value={String(completedLessons.count ?? 0)}
            detail="founder_lesson_progress (completed)"
            accent="indigo"
          />
          <MetricCard label="Quiz attempts" value={String(quizAttempts.count ?? 0)} detail="founder_quiz_attempts" accent="violet" />
          <MetricCard label="Quiz passes" value={String(passedAttempts.count ?? 0)} detail="founder_quiz_attempts (passed)" accent="blue" />
          <MetricCard
            label="Certificates issued"
            value={String(certificatesIssued.count ?? 0)}
            detail="Certificate of Completion"
            accent="slate"
          />
        </section>

        <WorkspacePanel title="Phase 1 limitations" subtitle="Safe metrics only; founder UX unchanged">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Completion rates per course/module require mapping lesson keys → course/module definitions (Phase 2).</li>
            <li>Weakest quiz areas require quiz definitions + question tagging (Phase 2).</li>
            <li>“Founders stuck” requires time-window analysis (Phase 2).</li>
          </ul>
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}

