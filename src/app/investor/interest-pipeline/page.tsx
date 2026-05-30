import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function InvestorInterestPipelinePage() {
  await requireRole(["investor"]);

  return (
    <AppShell role="INVESTOR" workspace="investor">
      <WorkspaceModulePlaceholder
        title="Interest Pipeline"
        description="Track expressed interest, indicative interest amounts, intro requests, and follow-up status across deals."
        futureItems={[
          "Expressed interest and indicative amount history",
          "Intro request and follow-up status by company",
          "Pipeline stages from saved deal to active engagement",
        ]}
        relatedHref="/investor/dashboard"
        relatedLabel="View interest activity on dashboard"
      />
    </AppShell>
  );
}
