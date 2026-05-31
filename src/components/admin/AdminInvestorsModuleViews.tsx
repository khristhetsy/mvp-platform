"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminInvestorReviewCard } from "@/components/AdminInvestorReviewCard";
import { AdminSubscriptionSummary } from "@/components/AdminSubscriptionSummary";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { PlanType, SubscriptionRecord } from "@/lib/subscriptions/plans";
import type { InvestorProfileRecord } from "@/lib/investor/types";
import { filterInvestorProfiles, type InvestorQueryFilters } from "@/lib/ui/query-filters";
import { getInvestorWorkspaceHref } from "@/lib/ui/drilldown-links";

type InvestorProfileWithMatching = InvestorProfileRecord & {
  profiles: { id: string; full_name: string | null; email: string | null; role: string | null; created_at: string } | null;
  matchingSummary?: { highMatchCompanyCount: number; topMatchScore: number };
};

type AuthProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

type Props = Readonly<{
  investorProfiles: InvestorProfileWithMatching[];
  investorActivity: {
    interests: Array<Record<string, unknown>>;
    introRequests: Array<Record<string, unknown>>;
    savedDeals: Array<Record<string, unknown>>;
  };
  investorAuthProfiles: AuthProfile[];
  subscriptionMap: Map<string, SubscriptionRecord | null>;
  requestedPlansMap: Map<string, PlanType | null>;
  profileLookup: Map<string, { full_name?: string | null; email?: string | null }>;
  investors: Array<{ id: string | null; name: string; email: string | null; lastSeen: string }>;
}>;

function AdminInvestorsModuleViewsInner({
  investorProfiles,
  investorActivity,
  investorAuthProfiles,
  subscriptionMap,
  requestedPlansMap,
  profileLookup,
  investors,
}: Props) {
  const { filters } = useAdminQueryFilters("investors");
  const investorFilters = filters as InvestorQueryFilters;

  const filteredProfiles = useMemo(
    () => filterInvestorProfiles(investorProfiles, investorFilters, profileLookup),
    [investorProfiles, investorFilters, profileLookup],
  );

  const pendingQueue = useMemo(
    () =>
      filteredProfiles.filter(
        (row) => row.approval_status === "submitted" || row.approval_status === "changes_requested",
      ),
    [filteredProfiles],
  );

  const remainingProfiles = useMemo(
    () => filteredProfiles.filter((row) => !pendingQueue.some((pending) => pending.id === row.id)),
    [filteredProfiles, pendingQueue],
  );

  const hasDrilldown =
    investorFilters.status ||
    investorFilters.approvalStatus ||
    investorFilters.q.trim().length > 0;

  return (
    <>
      <AdminQueryFilterBar page="investors" className="mb-4" />

      <WorkspacePanel
        title="Investor approval queue"
        subtitle={`${pendingQueue.length} profiles awaiting review`}
      >
        {pendingQueue.length === 0 ? (
          hasDrilldown ? (
            <ModuleEmptyState
              title="No matching investor approvals"
              description="Try clearing filters or adjusting the approval status."
            />
          ) : (
            <p className="text-sm text-slate-600">No investor profiles pending approval.</p>
          )
        ) : (
          <div className="grid gap-5">
            {pendingQueue.map((row) => (
              <AdminInvestorReviewCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </WorkspacePanel>

      <div className="mt-8">
        <WorkspacePanel
          title="All investor profiles"
          subtitle={`${filteredProfiles.length} onboarding records`}
        >
          {remainingProfiles.length === 0 ? (
            hasDrilldown ? (
              <ModuleEmptyState
                title="No matching investor profiles"
                description="Try clearing filters or adjusting the search term."
              />
            ) : (
              <p className="text-sm text-slate-600">No additional investor profiles.</p>
            )
          ) : (
            <div className="grid gap-5">
              {remainingProfiles.map((row) => (
                <AdminInvestorReviewCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="mt-8">
        <WorkspacePanel
          title="Investor subscriptions"
          subtitle={`${investorAuthProfiles.length} investor auth profiles`}
        >
          {investorAuthProfiles.length === 0 ? (
            <p className="text-sm text-slate-600">No investor profiles yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {investorAuthProfiles.map((investor) => (
                <div key={investor.id} className="grid gap-3 py-4 md:grid-cols-[1fr_1.2fr]">
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">{investor.full_name ?? investor.email ?? "Investor"}</p>
                    {investor.email ? <p className="text-slate-500">{investor.email}</p> : null}
                  </div>
                  <AdminSubscriptionSummary
                    subscription={subscriptionMap.get(investor.id) ?? null}
                    requestedPlan={requestedPlansMap.get(investor.id) ?? null}
                  />
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="mt-8">
        <WorkspacePanel
          title="Investor directory"
          subtitle={`${investors.length} investors with recorded activity`}
        >
          {investors.length === 0 ? (
            <p className="text-sm text-slate-600">No investor activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {investors.map((investor) => (
                <div key={`${investor.email ?? investor.name}`} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    {investor.id ? (
                      <Link href={getInvestorWorkspaceHref(investor.id)} className="font-medium text-indigo-700 hover:text-indigo-900">
                        {investor.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{investor.name}</p>
                    )}
                    {investor.email ? <p className="text-slate-500">{investor.email}</p> : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    Last activity{" "}
                    {investor.lastSeen
                      ? new Date(investor.lastSeen).toLocaleDateString("en-US", { timeZone: "UTC" })
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="mt-8">
        <AdminInvestorActivity
          interests={investorActivity.interests}
          introRequests={investorActivity.introRequests}
          savedDeals={investorActivity.savedDeals}
        />
      </div>
    </>
  );
}

export function AdminInvestorsModuleViews(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
      <AdminInvestorsModuleViewsInner {...props} />
    </Suspense>
  );
}
