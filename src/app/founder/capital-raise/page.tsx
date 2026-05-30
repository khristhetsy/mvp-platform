import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function FounderCapitalRaisePage() {
  await requireRole(["founder"]);

  return (
    <AppShell role="FOUNDER" workspace="founder">
      <WorkspaceModulePlaceholder
        title="Capital Raise"
        description="Track raise status, funding target, indicative investor interest, and campaign progress in one workspace."
        futureItems={[
          "Raise status and funding target overview",
          "Aggregate indicative interest and pledge totals",
          "Campaign progress and marketplace publication milestones",
        ]}
        relatedHref="/founder/dashboard"
        relatedLabel="View pledge summary on dashboard"
      />
    </AppShell>
  );
}
