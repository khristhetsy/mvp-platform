"use client";

import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { AdminCompanyCard, type AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";

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
};

export function AdminDashboardShell({
  userId,
  userRole,
  serviceRoleConfigured,
  metrics,
  pendingCount,
  companyCards,
  investorActivity,
}: Props) {
  return (
    <AdminActionHealthProvider
      userId={userId}
      userRole={userRole}
      serviceRoleConfigured={serviceRoleConfigured}
    >
      <div>
        <SectionHeader
          eyebrow="Admin dashboard"
          title="Review and publish curated opportunities"
          description="Manage submitted companies, pending diligence reviews, document uploads, and approval decisions."
        />

        <AdminButtonHealthPanel />

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          <MetricCard label="Founders" value={String(metrics.founders)} detail="Registered founder profiles" />
          <MetricCard label="Companies" value={String(metrics.companies)} detail="Total company submissions" />
          <MetricCard
            label="Pending reviews"
            value={String(metrics.pendingReviews)}
            detail="Awaiting admin decision"
          />
          <MetricCard label="Documents" value={String(metrics.documents)} detail={`${metrics.pitchDecks} pitch decks`} />
          <MetricCard
            label="Published deals"
            value={String(metrics.publishedDeals)}
            detail="Live on marketplace"
          />
        </section>

        {pendingCount > 0 ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-amber-950">Pending review queue</h2>
            <p className="mt-1 text-sm text-amber-900">
              {pendingCount} {pendingCount === 1 ? "company needs" : "companies need"} a decision.
            </p>
          </section>
        ) : null}

        <AdminInvestorActivity
          interests={investorActivity.interests}
          introRequests={investorActivity.introRequests}
          savedDeals={investorActivity.savedDeals}
        />

        <section className="mt-8 grid gap-5">
          {companyCards.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              No companies submitted yet.
            </div>
          ) : (
            companyCards.map((company) => <AdminCompanyCard key={company.id} company={company} />)
          )}
        </section>
      </div>
    </AdminActionHealthProvider>
  );
}
