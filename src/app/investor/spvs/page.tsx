import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function InvestorSpvsPage() {
  await requireRole(["investor"]);

  return (
    <AppShell role="INVESTOR" workspace="investor">
      <WorkspaceModulePlaceholder
        title="SPVs"
        description="Future workspace for SPV participation, subscription workflow, and co-investment vehicles."
        futureItems={[
          "SPV participation opportunities and invitations",
          "Subscription workflow and allocation tracking",
          "Co-investment vehicle documents and status",
        ]}
      />
    </AppShell>
  );
}
