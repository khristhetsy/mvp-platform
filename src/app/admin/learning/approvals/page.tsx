import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLearningApprovalsPage() {
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
          title="Approvals"
          description="Educational content only. Review workflow statuses and publish decisions."
          metadata="Phase 1: view-only (publish APIs next)"
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Pending course approvals" subtitle={`${(pendingPrograms ?? []).length} programs`}>
            {(pendingPrograms ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No programs pending review.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(pendingPrograms ?? []).map((p) => (
                  <div key={p.id} className="py-3 text-sm">
                    <p className="font-medium text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.slug} · {p.readiness_focus}</p>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Pending module approvals" subtitle={`${(pendingModules ?? []).length} modules`}>
            {(pendingModules ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No modules pending review.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(pendingModules ?? []).map((m) => (
                  <div key={m.id} className="py-3 text-sm">
                    <p className="font-medium text-slate-900">{m.title}</p>
                    <p className="text-xs text-slate-500">{m.slug} · {m.readiness_stage}</p>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>
        </section>
      </WorkspacePageContainer>
    </AppShell>
  );
}

