"use client";

import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { AdminCompanyCard, type AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { AdminInvestorCrmTimeline } from "@/components/AdminInvestorCrmTimeline";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { MetricCard } from "@/components/MetricCard";
import { DashboardInsightPanel } from "@/components/ui/DashboardInsightPanel";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { AdminOperationsBanner } from "@/components/ui/AdminOperationsBanner";
import { MetricRow } from "@/components/ui/OperationalMetric";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatLastUpdated } from "@/lib/ui/format-display";

import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";

type Props = {
  userId: string;
  userRole: string;
  serviceRoleConfigured: boolean;
  metrics: {
    founders: number;
    companies: number;
    pendingReviews: number;
    documents: number;
    pitchDecks: number;
    publishedDeals: number;
  };
  pendingCount: number;
  companyCards: AdminCompanyCardData[];
  investorActivity: {
    interests: Parameters<typeof AdminInvestorActivity>[0]["interests"];
    introRequests: Parameters<typeof AdminInvestorActivity>[0]["introRequests"];
    savedDeals: Parameters<typeof AdminInvestorActivity>[0]["savedDeals"];
  };
  crmActivity: AdminCrmActivityRow[];
};

export function AdminDashboardShell({
  userId,
  userRole,
  serviceRoleConfigured,
  metrics,
  pendingCount,
  companyCards,
  investorActivity,
  crmActivity,
}: Props) {
  return (
    <AdminActionHealthProvider
      userId={userId}
      userRole={userRole}
      serviceRoleConfigured={serviceRoleConfigured}
    >
      <div>
        <PageHeader
          eyebrow="Private capital operations"
          title="Command center"
          description="Company reviews, investor approvals, compliance visibility, SPV operations, and platform health."
          metadata={`Last loaded ${formatLastUpdated(new Date()) ?? "—"} · audit trail in audit_logs`}
          queueIndicator={
            pendingCount > 0 ? (
              <StatusBadge label={`${pendingCount} in review queue`} status="warning" dot />
            ) : (
              <StatusBadge label="Queue clear" status="success" dot />
            )
          }
        />

        <AdminOperationsBanner
          pendingReviews={pendingCount}
          serviceRoleOk={serviceRoleConfigured}
        />

        <MetricRow title="Operational metrics" subtitle="Platform-wide snapshot">
          <MetricCard
            label="Companies"
            value={String(metrics.companies)}
            detail={`${metrics.pendingReviews} pending review`}
            accent="indigo"
            urgency={metrics.pendingReviews > 0}
            sparklineValues={[2, 3, metrics.companies - 1, metrics.companies, metrics.companies, metrics.companies, metrics.companies]}
          />
          <MetricCard
            label="Investors"
            value="Review"
            detail="Onboarding at /admin/investors"
            accent="violet"
            sparklineValues={[1, 2, 3, 4, 5, 6, 7]}
          />
          <MetricCard
            label="Active raises"
            value={String(metrics.publishedDeals)}
            detail="Published marketplace"
            accent="blue"
            sparklineValues={[0, 0, 1, 1, metrics.publishedDeals, metrics.publishedDeals, metrics.publishedDeals]}
          />
          <MetricCard
            label="Platform health"
            value={serviceRoleConfigured ? "Online" : "Check"}
            detail={`${metrics.documents} docs · ${metrics.pitchDecks} decks`}
            accent="slate"
            statusLabel={serviceRoleConfigured ? "Operational" : "Degraded"}
            status={serviceRoleConfigured ? "success" : "warning"}
          />
        </MetricRow>

        <section className="mt-5">
          <DashboardInsightPanel title="Platform activity" subtitle="Reviews, uploads, and marketplace signals" />
        </section>

        <section className="mt-6">
          <AdminButtonHealthPanel />
        </section>

        <section className="mt-8">
          <AdminInvestorCrmTimeline activities={crmActivity} />
        </section>

        <AdminInvestorActivity
          interests={investorActivity.interests}
          introRequests={investorActivity.introRequests}
          savedDeals={investorActivity.savedDeals}
        />

        <section className="mt-8">
          <WorkspacePanel
            title="Platform Overview"
            subtitle={`${metrics.pendingReviews} pending reviews · ${companyCards.length} companies loaded`}
          >
            <div className="grid gap-5">
              {companyCards.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
                  No companies in queue. Submissions will appear here for institutional review.
                </div>
              ) : (
                companyCards.map((company) => <AdminCompanyCard key={company.id} company={company} />)
              )}
            </div>
          </WorkspacePanel>
        </section>
      </div>
    </AdminActionHealthProvider>
  );
}
