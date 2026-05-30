import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminCrmPage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="CRM"
        description="Investor–company pipeline, CRM activity timeline, and relationship tracking across CapitalOS."
        futureItems={[
          "Full investor CRM timeline and pipeline stages",
          "Company-level relationship and follow-up tracking",
          "Activity filters by type, investor, and company",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="View CRM timeline on dashboard"
      />
    </AppShell>
  );
}
