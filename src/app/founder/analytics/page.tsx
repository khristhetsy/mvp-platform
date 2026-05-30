import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function FounderAnalyticsPage() {
  await requireRole(["founder"]);

  return (
    <AppShell role="FOUNDER" workspace="founder">
      <WorkspaceModulePlaceholder
        title="Analytics"
        description="Analyze readiness trends, investor engagement, and capital progress over time."
        futureItems={[
          "Readiness score trends and document completeness metrics",
          "Investor engagement and pledge activity charts",
          "Capital progress against funding targets",
        ]}
        relatedHref="/founder/dashboard"
        relatedLabel="Open founder dashboard"
      />
    </AppShell>
  );
}
