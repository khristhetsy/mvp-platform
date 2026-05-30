import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminSystemHealthPage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="System Health"
        description="Admin health checks, service role status, database diagnostics, and integration monitoring."
        futureItems={[
          "Service role and Supabase connectivity checks",
          "Database table reachability and storage bucket status",
          "Admin action health panel and API diagnostics",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="View health panel on dashboard"
      />
    </AppShell>
  );
}
