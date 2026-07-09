import { useTranslations } from "next-intl";
import Link from "next/link";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildCompanyFilteredHref, type AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";
import { formatUsd } from "@/lib/ui/format-display";

function formatCurrency(value: number) {
  if (!value) return "—";
  return formatUsd(value);
}

export function CompanyInvestorActivityPanel({
  activity,
  companyId,
}: Readonly<{
  activity: AdminCompanyWorkspaceData["investorActivity"];
  companyId: string;
}>) {
  const t = useTranslations("adminCmp");
  return (
    <WorkspacePanel title={t("investor_engagement")} subtitle={t("aggregate_counts_no_private_message_content")}>
      <MetricGrid>
        <MetricCard label={t("saved_deals_2")} value={String(activity.savedDeals)} detail="Watchlist saves" accent="indigo" href={buildCompanyFilteredHref("/admin/crm", companyId, { activity: "saved_deal" })} />
        <MetricCard label={t("interests")} value={String(activity.interests)} detail="Expressed interest" accent="violet" href={buildCompanyFilteredHref("/admin/crm", companyId, { activity: "expressed_interest" })} />
        <MetricCard label={t("intro_requests_2")} value={String(activity.introRequests)} detail="Requested intros" accent="blue" href={buildCompanyFilteredHref("/admin/crm", companyId, { activity: "requested_intro" })} />
        <MetricCard label={t("message_threads")} value={String(activity.messageThreads)} detail={`${activity.meetingsScheduled} meetings scheduled`} accent="slate" href={buildCompanyFilteredHref("/admin/crm", companyId)} />
      </MetricGrid>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label={t("pledge_total")} value={formatCurrency(activity.pledgeTotal)} detail="From investor_interests" accent="indigo" href={buildCompanyFilteredHref("/admin/crm", companyId)} />
        <MetricCard label={t("interest_amounts")} value={formatCurrency(activity.interestAmountTotal)} detail="Indicative totals" accent="slate" href={buildCompanyFilteredHref("/admin/crm", companyId)} />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Source: investor_interests, saved_deals, intro_requests, message_threads ·{" "}
        <Link href={buildCompanyFilteredHref("/admin/crm", companyId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Open CRM
        </Link>
      </p>
    </WorkspacePanel>
  );
}
