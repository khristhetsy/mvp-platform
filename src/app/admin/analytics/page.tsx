import { AppShell } from "@/components/AppShell";
import { WorkspaceModulePlaceholder } from "@/components/WorkspaceModulePlaceholder";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminAnalyticsPage() {
  await requireRole(["admin", "analyst"]);

  return (
    <AppShell role="ADMIN" workspace="admin">
      <WorkspaceModulePlaceholder
        title="Analytics"
        description="Platform-wide metrics for companies, investors, diligence throughput, and marketplace activity."
        futureItems={[
          "Company submission and approval funnel metrics",
          "Investor engagement and pledge aggregate trends",
          "Marketplace publication and CRM activity dashboards",
        ]}
        relatedHref="/admin/dashboard"
        relatedLabel="View dashboard metrics"
      />
    </AppShell>
  );
}
