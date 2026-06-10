import Link from "next/link";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildCompanyFilteredHref, type AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function CompanyInvestorActivityPanel({
  activity,
  companyId,
}: Readonly<{
  activity: AdminCompanyWorkspaceData["investorActivity"];
  companyId: string;
}>) {
  return (
    <WorkspacePanel title="Investor engagement" subtitle="Aggregate counts — no private message content">
      <MetricGrid>
        <MetricCard label="Saved deals" value={String(activity.savedDeals)} detail="Watchlist saves" accent="indigo" href={buildCompanyFilteredHref("/admin/crm", companyId, { activity: "saved_deal" })} />
        <MetricCard label="Interests" value={String(activity.interests)} detail="Expressed interest" accent="violet" href={buildCompanyFilteredHref("/admin/crm", companyId, { activity: "expressed_interest" })} />
        <MetricCard label="Intro requests" value={String(activity.introRequests)} detail="Requested intros" accent="blue" href={buildCompanyFilteredHref("/admin/crm", companyId, { activity: "requested_intro" })} />
        <MetricCard label="Message threads" value={String(activity.messageThreads)} detail={`${activity.meetingsScheduled} meetings scheduled`} accent="slate" href={buildCompanyFilteredHref("/admin/crm", companyId)} />
      </MetricGrid>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Pledge total" value={formatCurrency(activity.pledgeTotal)} detail="From investor_interests" accent="indigo" href={buildCompanyFilteredHref("/admin/crm", companyId)} />
        <MetricCard label="Interest amounts" value={formatCurrency(activity.interestAmountTotal)} detail="Indicative totals" accent="slate" href={buildCompanyFilteredHref("/admin/crm", companyId)} />
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
