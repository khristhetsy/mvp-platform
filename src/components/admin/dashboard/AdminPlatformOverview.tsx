import { useTranslations } from "next-intl";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { ClickableCard } from "@/components/ui/drilldown";
import { PageSection } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  getCompanyStatusHref,
  getDrilldownHref,
  getInvestorStatusHref,
} from "@/lib/ui/drilldown-links";
import type { AdminCommandCenterSnapshot } from "@/components/admin/dashboard/types";

type SummaryStat = {
  label: string;
  value: string;
  detail?: string;
  href: string;
};

function SummaryCard({ label, value, detail, href }: SummaryStat) {
  return (
    <ClickableCard href={href} ariaLabel={`View ${label}`}>
      <div className={`flex h-full flex-col rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 transition-colors hover:border-slate-300 hover:bg-white`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-950">{value}</p>
        {detail ? <p className="mt-auto pt-1 text-xs text-slate-600">{detail}</p> : null}
      </div>
    </ClickableCard>
  );
}

function countByReviewStatus(companies: AdminCompanyCardData[]) {
  const counts = new Map<string, number>();
  for (const company of companies) {
    const key = company.review_status ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function buildPlanDistribution(companies: AdminCompanyCardData[]) {
  const counts = new Map<string, number>();
  for (const company of companies) {
    const plan = company.founder_subscription?.plan_type ?? company.founder_requested_plan ?? "none";
    counts.set(String(plan), (counts.get(String(plan)) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function AdminPlatformOverview({
  companyCards,
  snapshot,
}: Readonly<{
  companyCards: AdminCompanyCardData[];
  snapshot: AdminCommandCenterSnapshot;
}>) {
  const t = useTranslations("adminCmp");
  const reviewStatusCounts = countByReviewStatus(companyCards);
  const planDistribution = buildPlanDistribution(companyCards);
  const publishedCount = companyCards.filter((c) => c.is_published).length;
  const marketplaceCount = companyCards.filter((c) => c.marketplace_visible).length;
  const totalUpdates = companyCards.reduce((sum, c) => sum + c.company_updates_published_count, 0);

  return (
    <PageSection title={t("platform_overview")} subtitle={t("operational_summaries_across_companies_and_s")}>
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspacePanel title={t("companies_by_status")} subtitle={`${companyCards.length} companies loaded`}>
          {reviewStatusCounts.length === 0 ? (
            <p className="text-sm text-slate-500">{t("no_companies_loaded")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {reviewStatusCounts.map(([status, count]) => (
                <SummaryCard
                  key={status}
                  label={status.replace(/_/g, " ")}
                  value={String(count)}
                  detail={`${publishedCount} published · ${marketplaceCount} marketplace visible`}
                  href={getCompanyStatusHref(status)}
                />
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title={t("investor_compliance_mix")} subtitle={t("approval_and_event_posture")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryCard
              label={t("pending_investor_approvals")}
              value={String(snapshot.pendingInvestorApprovals)}
              detail={`${snapshot.totalInvestors} total investor profiles`}
              href={getInvestorStatusHref("submitted")}
            />
            <SummaryCard
              label={t("open_compliance_events_2")}
              value={String(snapshot.openComplianceEvents)}
              detail="Requires compliance review"
              href={getDrilldownHref("compliance_open")}
            />
            <SummaryCard
              label={t("notifications")}
              value={String(snapshot.notificationCount)}
              detail="Platform notification records"
              href={getDrilldownHref("notifications")}
            />
            <SummaryCard
              label={t("reports_generated")}
              value={String(snapshot.reportsGenerated)}
              detail="Diligence reports on file"
              href={getDrilldownHref("reports")}
            />
          </div>
        </WorkspacePanel>

        <WorkspacePanel title={t("subscription_distribution")} subtitle={t("founder_plan_mix_across_loaded_companies")}>
          {planDistribution.length === 0 ? (
            <p className="text-sm text-slate-500">{t("no_subscription_data_available")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {planDistribution.map(([plan, count]) => (
                <SummaryCard
                  key={plan}
                  label={plan}
                  value={String(count)}
                  href={getDrilldownHref("subscriptions")}
                />
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title={t("engagement_signals")} subtitle={t("updates_and_upgrade_pipeline")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryCard
              label={t("company_updates_published")}
              value={String(totalUpdates)}
              detail="Across loaded founder companies"
              href={getDrilldownHref("company_updates")}
            />
            <SummaryCard
              label={t("pending_upgrade_requests")}
              value={String(snapshot.pendingUpgradeRequests)}
              detail="Billing upgrade queue"
              href={getDrilldownHref("upgrade_requests")}
            />
            <SummaryCard
              label={t("spv_pipeline")}
              value={String(snapshot.spvPipelineCount)}
              detail="Active SPV opportunities"
              href={getDrilldownHref("spv_activity")}
            />
            <SummaryCard
              label={t("open_compliance")}
              value={String(snapshot.openComplianceEvents)}
              detail="Open vs resolved tracked in compliance module"
              href={getDrilldownHref("compliance_open")}
            />
          </div>
        </WorkspacePanel>
      </div>
    </PageSection>
  );
}
