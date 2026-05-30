import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminCompliancePage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="Compliance"
        description="Compliance review, audit trail visibility, and risk flag management across the platform."
        futureItems={[
          "Compliance review queue and disclosure checks",
          "Audit log search and export",
          "Risk flag tracking and resolution workflow",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="Open admin dashboard"
      />
    </AppShell>
  );
}
