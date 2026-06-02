import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewLearningCoursePage() {
  const profile = await requireRole(["admin", "analyst"]);

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
          title="New course"
          description="Phase 1 scaffolding. Create course via API (coming next in this branch)."
          metadata="Educational content only. No investment/legal/tax advice."
        />
        <p className="text-sm text-slate-600">
          Placeholder: next commit will add the course create form + API route.
        </p>
      </WorkspacePageContainer>
    </AppShell>
  );
}

