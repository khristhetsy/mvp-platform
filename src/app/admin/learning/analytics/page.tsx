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

  const [progressCount, completedLessons, quizAttempts, passedAttempts] = await Promise.all([
    supabase.from("learning_progress").select("id", { count: "exact", head: true }),
    supabase
      .from("founder_lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("founder_quiz_attempts").select("id", { count: "exact", head: true }),
    supabase.from("founder_quiz_attempts").select("id", { count: "exact", head: true }).eq("passed", true),
  ]);

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
          <MetricCard label="Lesson completions" value={String(completedLessons.count ?? 0)} detail="founder_lesson_progress" accent="violet" />
          <MetricCard label="Quiz attempts" value={String(quizAttempts.count ?? 0)} detail="founder_quiz_attempts" accent="blue" />
          <MetricCard label="Quiz passes" value={String(passedAttempts.count ?? 0)} detail="passed=true" accent="slate" />
        </section>

        <WorkspacePanel title="Phase 1 limitations" subtitle="More analytics will be added without changing founder UX">
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

