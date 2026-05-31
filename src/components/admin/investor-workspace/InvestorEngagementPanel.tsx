import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildInvestorFilteredHref, type AdminInvestorWorkspaceData } from "@/lib/admin/investor-workspace-types";

function formatCurrency(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function InvestorEngagementPanel({
  engagement,
  profileId,
}: Readonly<{
  engagement: AdminInvestorWorkspaceData["engagement"];
  profileId: string;
}>) {
  return (
    <WorkspacePanel title="Engagement metrics" subtitle="Counts and indicative amounts only">
      <MetricGrid>
        <MetricCard
          label="Saved deals"
          value={String(engagement.savedDeals)}
          detail="Watchlist saves"
          accent="indigo"
          href={buildInvestorFilteredHref("/admin/crm", profileId, { activity: "saved_deal" })}
        />
        <MetricCard
          label="Interests"
          value={String(engagement.interests)}
          detail="Expressed interest"
          accent="violet"
          href={buildInvestorFilteredHref("/admin/crm", profileId, { activity: "expressed_interest" })}
        />
        <MetricCard
          label="Intro requests"
          value={String(engagement.introRequests)}
          detail="Requested intros"
          accent="blue"
          href={buildInvestorFilteredHref("/admin/crm", profileId, { activity: "requested_intro" })}
        />
        <MetricCard
          label="Messages & meetings"
          value={String(engagement.messageThreads)}
          detail={`${engagement.meetingsScheduled} meetings scheduled`}
          accent="slate"
          href={buildInvestorFilteredHref("/admin/crm", profileId)}
        />
      </MetricGrid>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Pledge total" value={formatCurrency(engagement.pledgeTotal)} detail="From investor_interests" accent="indigo" />
        <MetricCard label="Interest amounts" value={formatCurrency(engagement.interestAmountTotal)} detail="Indicative totals" accent="slate" />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Source: investor_interests, saved_deals, intro_requests, message_threads ·{" "}
        <Link href={buildInvestorFilteredHref("/admin/crm", profileId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Open CRM
        </Link>
      </p>
    </WorkspacePanel>
  );
}
