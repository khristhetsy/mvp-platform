import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { AdminApprovalsQueue } from "@/components/admin/learning/AdminApprovalsQueue";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminModuleComingSoon } from "@/lib/admin/module-flags";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLearningApprovalsPage() {
  if (isAdminModuleComingSoon("learning")) {
    redirect("/admin/learning");
  }

  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const { data: pendingPrograms } = await supabase
    .from("learning_programs")
    .select("id, title, slug, content_status, is_published, readiness_focus, created_at")
    .eq("content_status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: pendingModules } = await supabase
    .from("learning_modules")
    .select("id, title, slug, content_status, is_published, readiness_stage, created_at")
    .eq("content_status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: pendingLessons } = await supabase
    .from("learning_lessons")
    .select("id, title, module_slug, content_status, updated_at")
    .eq("content_status", "pending_review")
    .order("updated_at", { ascending: false })
    .limit(200);

  const { data: pendingQuizzes } = await supabase
    .from("learning_quizzes")
    .select("id, title, scope_type, content_status, updated_at")
    .eq("content_status", "pending_review")
    .order("updated_at", { ascending: false })
    .limit(200);

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
          eyebrow="Admin Learning"
          title="Approvals"
          description="Educational content only. Review workflow statuses and publish decisions."
          metadata="Phase 1: approve/publish/archive with status history"
        />

        <WorkspacePanel
          title="Pending review queue"
          subtitle={`${(pendingPrograms ?? []).length + (pendingModules ?? []).length + (pendingLessons ?? []).length + (pendingQuizzes ?? []).length} items`}
        >
          <AdminApprovalsQueue
            programs={(pendingPrograms ?? []).map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              content_status: p.content_status,
              is_published: p.is_published,
            }))}
            modules={(pendingModules ?? []).map((m) => ({
              id: m.id,
              title: m.title,
              slug: m.slug,
              content_status: m.content_status,
              is_published: m.is_published,
            }))}
            lessons={(pendingLessons ?? []).map((l) => ({
              id: l.id,
              title: l.title,
              slug: l.module_slug,
              content_status: l.content_status,
            }))}
            quizzes={(pendingQuizzes ?? []).map((q) => ({
              id: q.id,
              title: q.title,
              slug: q.scope_type,
              content_status: q.content_status,
            }))}
          />
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}

