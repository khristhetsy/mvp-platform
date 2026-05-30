import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function InvestorWatchlistPage() {
  await requireRole(["investor"]);

  return (
    <AppShell role="INVESTOR" workspace="investor">
      <WorkspaceModulePlaceholder
        title="Watchlist"
        description="Review saved deals and companies you are tracking across the CapitalOS marketplace."
        futureItems={[
          "Saved deals with status and last-updated timestamps",
          "Quick links to deal detail and investor actions",
          "Alerts when watched companies publish updates",
        ]}
        relatedHref="/investor/dashboard"
        relatedLabel="View saved deals on dashboard"
      />
    </AppShell>
  );
}
