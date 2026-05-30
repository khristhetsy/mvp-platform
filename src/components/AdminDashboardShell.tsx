"use client";

import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { AdminCompanyCard, type AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { AdminInvestorCrmTimeline } from "@/components/AdminInvestorCrmTimeline";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";

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
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage submitted companies, pending diligence reviews, document uploads, and approval decisions.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Companies" value={String(metrics.companies)} detail="Total company submissions" accent="indigo" />
          <MetricCard label="Total Investors" value="—" detail="Investor directory metrics coming soon" accent="violet" />
          <MetricCard
            label="Active Raises"
            value={String(metrics.publishedDeals)}
            detail="Live on marketplace"
            accent="blue"
          />
          <MetricCard
            label="Platform Health"
            value={serviceRoleConfigured ? "Online" : "Check config"}
            detail={`${metrics.documents} documents · ${metrics.pitchDecks} pitch decks`}
            accent="slate"
          />
        </section>

        {pendingCount > 0 ? (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-amber-950">Pending review queue</h2>
            <p className="mt-1 text-sm text-amber-900">
              {pendingCount} {pendingCount === 1 ? "company needs" : "companies need"} a decision.
            </p>
          </section>
        ) : null}

        <section className="mt-8">
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
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  No companies submitted yet.
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
