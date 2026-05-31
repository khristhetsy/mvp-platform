import { MetricCard } from "@/components/MetricCard";
import { PageSection } from "@/components/ui/workspace-layout";
import { getAdminKpiHref } from "@/lib/ui/drilldown-links";
import type { AdminCommandCenterSnapshot, AdminDashboardMetrics } from "@/components/admin/dashboard/types";

export function AdminKpiGrid({
  metrics,
  snapshot,
  serviceRoleConfigured,
}: Readonly<{
  metrics: AdminDashboardMetrics;
  snapshot: AdminCommandCenterSnapshot;
  serviceRoleConfigured: boolean;
}>) {
  return (
    <PageSection title="Operational metrics" subtitle="Platform-wide snapshot">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        <MetricCard
          label="Total Companies"
          value={String(metrics.companies)}
          detail={`${metrics.founders} founder profiles`}
          accent="indigo"
          href={getAdminKpiHref("total_companies")}
        />
        <MetricCard
          label="Total Investors"
          value={String(snapshot.totalInvestors)}
          detail={
            snapshot.pendingInvestorApprovals > 0
              ? `${snapshot.pendingInvestorApprovals} pending approval`
              : "Investor onboarding active"
          }
          accent="violet"
          urgency={snapshot.pendingInvestorApprovals > 0}
          status={snapshot.pendingInvestorApprovals > 0 ? "warning" : "success"}
          statusLabel={snapshot.pendingInvestorApprovals > 0 ? "Action needed" : "Clear"}
          href={getAdminKpiHref("total_investors")}
        />
        <MetricCard
          label="Active Raises"
          value={String(metrics.publishedDeals)}
          detail="Published marketplace listings"
          accent="blue"
          href={getAdminKpiHref("active_raises")}
        />
        <MetricCard
          label="Pending Reviews"
          value={String(metrics.pendingReviews)}
          detail="Companies awaiting institutional review"
          accent="slate"
          urgency={metrics.pendingReviews > 0}
          status={metrics.pendingReviews > 0 ? "warning" : "success"}
          statusLabel={metrics.pendingReviews > 0 ? "In queue" : "Clear"}
          href={getAdminKpiHref("pending_reviews")}
        />
        <MetricCard
          label="Platform Health"
          value={serviceRoleConfigured ? "Online" : "Degraded"}
          detail={`${metrics.documents} documents · ${metrics.pitchDecks} pitch decks`}
          accent="slate"
          status={serviceRoleConfigured ? "success" : "warning"}
          statusLabel={serviceRoleConfigured ? "Operational" : "Check config"}
          href={getAdminKpiHref("platform_health")}
        />
        <MetricCard
          label="Open Compliance Events"
          value={String(snapshot.openComplianceEvents)}
          detail="Open compliance queue items"
          accent="slate"
          urgency={snapshot.openComplianceEvents > 0}
          status={snapshot.openComplianceEvents > 0 ? "danger" : "success"}
          statusLabel={snapshot.openComplianceEvents > 0 ? "Open" : "Clear"}
          href={getAdminKpiHref("compliance_open")}
        />
        <MetricCard
          label="SPV Readiness"
          value={String(snapshot.spvPipelineCount)}
          detail="Active SPV opportunities in pipeline"
          accent="indigo"
          href={getAdminKpiHref("spv_readiness")}
        />
        <MetricCard
          label="Upgrade Requests"
          value={String(snapshot.pendingUpgradeRequests)}
          detail="Pending billing upgrade requests"
          accent="violet"
          urgency={snapshot.pendingUpgradeRequests > 0}
          status={snapshot.pendingUpgradeRequests > 0 ? "pending" : "neutral"}
          statusLabel={snapshot.pendingUpgradeRequests > 0 ? "Pending" : "None"}
          href={getAdminKpiHref("upgrade_requests")}
        />
      </div>
    </PageSection>
  );
}
