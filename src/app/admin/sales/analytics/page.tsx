import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadSalesAnalytics } from "@/lib/sales-analytics/metrics";
import { getSalesScope, effectiveSalesOwner } from "@/lib/sales/scope";
import { SalesHubHeader } from "../SalesHubHeader";
import { SalesAnalyticsClient } from "./SalesAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function SalesAnalyticsPage({ searchParams }: { searchParams: Promise<{ viewAs?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const scope = await getSalesScope(profile, (await searchParams).viewAs ?? null);
  const metrics = await loadSalesAnalytics(effectiveSalesOwner(scope));
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <SalesAnalyticsClient metrics={metrics} />
    </AppShell>
  );
}
