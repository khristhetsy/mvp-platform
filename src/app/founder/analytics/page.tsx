import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function FounderAnalyticsPage() {
  await requireRole(["founder"]);

  return (
    <FounderAppShell>
      <FounderFeatureGate featureKey="analytics">
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
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
