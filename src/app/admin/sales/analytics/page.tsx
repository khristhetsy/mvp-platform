import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadSalesAnalytics } from "@/lib/sales-analytics/metrics";
import { getSalesScope } from "@/lib/sales/scope";
import { SalesHubHeader } from "../SalesHubHeader";
import { SalesAnalyticsClient } from "./SalesAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function SalesAnalyticsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const scope = await getSalesScope(profile);
  const metrics = await loadSalesAnalytics(scope.isManager ? null : scope.ownerId);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <SalesAnalyticsClient metrics={metrics} />
    </AppShell>
  );
}
