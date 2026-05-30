import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function InvestorAnalyticsPage() {
  await requireRole(["investor"]);

  return (
    <AppShell role="INVESTOR" workspace="investor">
      <WorkspaceModulePlaceholder
        title="Analytics"
        description="Investor engagement metrics, allocation insights, and opportunity tracking across your workflow."
        futureItems={[
          "Engagement metrics across saved deals and expressed interest",
          "Allocation insights and indicative interest trends",
          "Opportunity tracking and pipeline conversion views",
        ]}
        relatedHref="/investor/dashboard"
        relatedLabel="Open investor dashboard"
      />
    </AppShell>
  );
}
