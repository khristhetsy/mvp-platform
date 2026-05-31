import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { PageSection } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminCommandCenterSnapshot } from "@/components/admin/dashboard/types";

type SummaryStat = {
  label: string;
  value: string;
  detail?: string;
};

function SummaryCard({ label, value, detail }: SummaryStat) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200/80 bg-slate-50/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-950">{value}</p>
      {detail ? <p className="mt-auto pt-1 text-xs text-slate-600">{detail}</p> : null}
    </div>
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
  const reviewStatusCounts = countByReviewStatus(companyCards);
  const planDistribution = buildPlanDistribution(companyCards);
  const publishedCount = companyCards.filter((c) => c.is_published).length;
  const marketplaceCount = companyCards.filter((c) => c.marketplace_visible).length;
  const totalUpdates = companyCards.reduce((sum, c) => sum + c.company_updates_published_count, 0);

  return (
    <PageSection title="Platform overview" subtitle="Operational summaries across companies and subscriptions">
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspacePanel title="Companies by status" subtitle={`${companyCards.length} companies loaded`}>
          {reviewStatusCounts.length === 0 ? (
            <p className="text-sm text-slate-500">No companies loaded.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {reviewStatusCounts.map(([status, count]) => (
                <SummaryCard
                  key={status}
                  label={status.replace(/_/g, " ")}
                  value={String(count)}
                  detail={`${publishedCount} published · ${marketplaceCount} marketplace visible`}
                />
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Investor & compliance mix" subtitle="Approval and event posture">
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryCard
              label="Pending investor approvals"
              value={String(snapshot.pendingInvestorApprovals)}
              detail={`${snapshot.totalInvestors} total investor profiles`}
            />
            <SummaryCard
              label="Open compliance events"
              value={String(snapshot.openComplianceEvents)}
              detail="Requires compliance review"
            />
            <SummaryCard
              label="Notifications"
              value={String(snapshot.notificationCount)}
              detail="Platform notification records"
            />
            <SummaryCard
              label="Reports generated"
              value={String(snapshot.reportsGenerated)}
              detail="Diligence reports on file"
            />
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Subscription distribution" subtitle="Founder plan mix across loaded companies">
          {planDistribution.length === 0 ? (
            <p className="text-sm text-slate-500">No subscription data available.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {planDistribution.map(([plan, count]) => (
                <SummaryCard key={plan} label={plan} value={String(count)} />
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Engagement signals" subtitle="Updates and upgrade pipeline">
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryCard
              label="Company updates published"
              value={String(totalUpdates)}
              detail="Across loaded founder companies"
            />
            <SummaryCard
              label="Pending upgrade requests"
              value={String(snapshot.pendingUpgradeRequests)}
              detail="Billing upgrade queue"
            />
            <SummaryCard
              label="SPV pipeline"
              value={String(snapshot.spvPipelineCount)}
              detail="Active SPV opportunities"
            />
            <SummaryCard
              label="Open compliance"
              value={String(snapshot.openComplianceEvents)}
              detail="Open vs resolved tracked in compliance module"
            />
          </div>
        </WorkspacePanel>
      </div>
    </PageSection>
  );
}
