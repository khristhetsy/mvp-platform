import { AppShell } from "@/components/AppShell";
import { AdminImportExportCenter } from "@/components/admin/AdminImportExportCenter";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { listImportBatches } from "@/lib/imports/batches";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();
  let batches: Awaited<ReturnType<typeof listImportBatches>> = [];

  try {
    batches = await listImportBatches(admin, 25);
  } catch {
    batches = [];
  }

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
          eyebrow="Admin Workspace"
          title="Import / Export Center"
          description="Upload structured platform data with preview, validation, and audit logging. Imports never auto-approve investors or publish companies."
        />
        <AdminImportExportCenter initialBatches={batches} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
