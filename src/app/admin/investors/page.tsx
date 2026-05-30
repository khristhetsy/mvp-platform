import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminInvestorsPage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="Investors"
        description="Manage investor profiles, marketplace activity, and platform engagement."
        futureItems={[
          "Investor profile directory and role management",
          "Interest, intro, and pledge activity summaries",
          "Investor-level audit and CRM history",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="View investor activity on dashboard"
      />
    </AppShell>
  );
}
