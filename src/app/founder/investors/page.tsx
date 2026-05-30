import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function FounderInvestorsPage() {
  await requireRole(["founder"]);

  return (
    <AppShell role="FOUNDER" workspace="founder">
      <WorkspaceModulePlaceholder
        title="Investors"
        description="Monitor investor activity, expressed interest, follow-ups, and capital relationships on your listing."
        futureItems={[
          "Investor activity feed and interest summaries",
          "Follow-up requests and intro pipeline status",
          "Capital relationship tracking across marketplace investors",
        ]}
        relatedHref="/founder/dashboard"
        relatedLabel="View dashboard investor activity"
      />
    </AppShell>
  );
}
