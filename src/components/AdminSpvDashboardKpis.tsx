import { MetricCard } from "@/components/MetricCard";
import { MetricGridWide } from "@/components/ui/workspace-layout";
import { formatDashboardIndicativeTotal, type AdminSpvDashboardMetrics } from "@/lib/spv/readiness";

export function AdminSpvDashboardKpis({
  metrics,
}: Readonly<{ metrics: AdminSpvDashboardMetrics }>) {
  return (
    <MetricGridWide>
      <MetricCard label="Total SPVs" value={String(metrics.totalSpvs)} detail="All opportunities" accent="indigo" href="/admin/spvs" />
      <MetricCard label="Open SPVs" value={String(metrics.openSpvs)} detail="Accepting participation" accent="violet" href="/admin/spvs" />
      <MetricCard
        label="Document-ready SPVs"
        value={String(metrics.documentReadySpvs)}
        detail="Checklist at 100%"
        accent="blue"
        href="/admin/spvs"
      />
      <MetricCard
        label="Indicative SPV interest"
        value={formatDashboardIndicativeTotal(metrics.totalIndicativeInterest)}
        detail="Non-binding totals"
        accent="indigo"
        href="/admin/spvs"
      />
      <MetricCard
        label="Investors document-ready"
        value={String(metrics.investorsDocumentReady)}
        detail="Across all SPVs"
        accent="violet"
        href="/admin/investors"
      />
      <MetricCard
        label="Pending investor requirements"
        value={String(metrics.pendingInvestorRequirements)}
        detail="Needs upload or review"
        accent="blue"
        href="/admin/investors"
      />
    </MetricGridWide>
  );
}
