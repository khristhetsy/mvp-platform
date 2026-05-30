import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function InvestorPortfolioPage() {
  await requireRole(["investor"]);

  return (
    <AppShell role="INVESTOR" workspace="investor">
      <WorkspaceModulePlaceholder
        title="Portfolio"
        description="Future workspace for active investments, reporting, and portfolio-level analytics."
        futureItems={[
          "Active investment positions and commitment history",
          "Portfolio reporting and document access",
          "Performance and allocation summaries",
        ]}
      />
    </AppShell>
  );
}
