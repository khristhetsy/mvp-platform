import { MetricCard } from "@/components/MetricCard";
import { useTranslations } from "next-intl";
import { MetricGridWide } from "@/components/ui/workspace-layout";
import { formatDashboardIndicativeTotal, type AdminSpvDashboardMetrics } from "@/lib/spv/readiness";

export function AdminSpvDashboardKpis({
  metrics,
}: Readonly<{ metrics: AdminSpvDashboardMetrics }>) {
  const t = useTranslations("sharedCmp");
  return (
    <MetricGridWide>
      <MetricCard label={t("total_spvs")} value={String(metrics.totalSpvs)} detail="All opportunities" accent="indigo" href="/admin/spvs" />
      <MetricCard label={t("open_spvs")} value={String(metrics.openSpvs)} detail="Accepting participation" accent="violet" href="/admin/spvs" />
      <MetricCard
        label={t("document_ready_spvs")}
        value={String(metrics.documentReadySpvs)}
        detail="Checklist at 100%"
        accent="blue"
        href="/admin/spvs"
      />
      <MetricCard
        label={t("indicative_spv_interest")}
        value={formatDashboardIndicativeTotal(metrics.totalIndicativeInterest)}
        detail="Non-binding totals"
        accent="indigo"
        href="/admin/spvs"
      />
      <MetricCard
        label={t("investors_document_ready")}
        value={String(metrics.investorsDocumentReady)}
        detail="Across all SPVs"
        accent="violet"
        href="/admin/investors"
      />
      <MetricCard
        label={t("pending_investor_requirements")}
        value={String(metrics.pendingInvestorRequirements)}
        detail="Needs upload or review"
        accent="blue"
        href="/admin/investors"
      />
    </MetricGridWide>
  );
}
