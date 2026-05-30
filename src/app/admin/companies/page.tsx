import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminCompaniesPage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="Companies"
        description="Manage company profiles, submissions, marketplace publication, and founder-linked records."
        futureItems={[
          "Dedicated company list with review and publication filters",
          "Submission status, document completeness, and approval workflow",
          "Marketplace visibility controls per company",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="Manage companies on admin dashboard"
      />
    </AppShell>
  );
}
