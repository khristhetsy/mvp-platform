"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminInvestorReviewCard } from "@/components/AdminInvestorReviewCard";
import { AdminSubscriptionSummary } from "@/components/AdminSubscriptionSummary";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { PlanType, SubscriptionRecord } from "@/lib/subscriptions/plans";
import type { InvestorApprovalStatus, InvestorProfileRecord } from "@/lib/investor/types";
import type { KycReviewItem } from "@/lib/investor/kyc";
import type { InvestorPriorDealRecord } from "@/lib/investor/types";
import { filterInvestorProfiles, type InvestorQueryFilters } from "@/lib/ui/query-filters";

type InvestorsPageView = "cards" | "table" | "approval" | "segments" | "activity";

function parseInvestorsPageView(raw: string | null): InvestorsPageView {
  switch ((raw ?? "").toLowerCase()) {
    case "table":
    case "approval":
    case "segments":
    case "activity":
      return raw as InvestorsPageView;
    case "cards":
    default:
      return "cards";
  }
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type InvestorProfileWithMatching = InvestorProfileRecord & {
  profiles: { id: string; full_name: string | null; email: string | null; role: string | null; created_at: string } | null;
  matchingSummary?: { highMatchCompanyCount: number; topMatchScore: number };
  kycReview?: { items: KycReviewItem[]; canSubmit: boolean };
  priorDeals?: InvestorPriorDealRecord[];
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

function InvestorsPageToolbar({
  view,
  onViewChange,
  filters,
  onFilterChange,
  onClearFilters,
}: Readonly<{
  view: InvestorsPageView;
  onViewChange: (next: InvestorsPageView) => void;
  filters: InvestorQueryFilters;
  onFilterChange: (patch: Partial<Pick<InvestorQueryFilters, "q" | "approvalStatus" | "type" | "sector" | "checkSize">>) => void;
  onClearFilters: () => void;
}>) {
  const views: Array<{ id: InvestorsPageView; label: string }> = [
    { id: "cards", label: "Cards" },
    { id: "table", label: "Table" },
    { id: "approval", label: "Approval" },
    { id: "segments", label: "Segments" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div
      className="sticky z-20 mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-panel)]"
      style={{ top: "calc(var(--workspace-toolbar-top) + 0.5rem)" }}
      role="region"
      aria-label="Investor view controls"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">View</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm" role="group" aria-label="Investor view">
            {views.map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={active}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-[var(--blue)] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  onClick={() => onViewChange(v.id)}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear filters
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr_0.9fr]">
        <input
          value={filters.q}
          onChange={(e) => onFilterChange({ q: e.target.value })}
          placeholder="Search investors…"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />

        <select
          value={filters.approvalStatus ?? ""}
          onChange={(e) =>
            onFilterChange({
              approvalStatus: e.target.value ? (e.target.value as InvestorApprovalStatus) : null,
            })
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">Approval status</option>
          <option value="submitted">Submitted</option>
          <option value="changes_requested">Changes requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>

        <select
          value={filters.type ?? ""}
          onChange={(e) => onFilterChange({ type: e.target.value || null })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">Investor type</option>
          <option value="individual">Individual</option>
          <option value="angel_group">Angel group</option>
          <option value="family_office">Family office</option>
          <option value="venture_fund">Venture fund</option>
          <option value="corporate">Corporate</option>
          <option value="other">Other</option>
        </select>

        <input
          value={filters.sector ?? ""}
          onChange={(e) => onFilterChange({ sector: e.target.value || null })}
          placeholder="Sector (exact)"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />

        <input
          value={filters.checkSize ?? ""}
          onChange={(e) => onFilterChange({ checkSize: e.target.value ? Number(e.target.value) : null })}
          placeholder="Check size (number)"
          inputMode="numeric"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function InvestorProfilesTable({ rows }: Readonly<{ rows: InvestorProfileWithMatching[] }>) {
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3">Investor</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Firm</th>
            <th className="px-4 py-3">Approval</th>
            <th className="px-4 py-3">Check size</th>
            <th className="px-4 py-3">Sectors</th>
            <th className="px-4 py-3">Geographies</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">
                  {row.profiles?.full_name ?? row.profiles?.email ?? "Investor"}
                </p>
                {row.profiles?.email ? <p className="text-xs text-slate-500">{row.profiles.email}</p> : null}
              </td>
              <td className="px-4 py-3 text-slate-700">{row.investor_type ?? "—"}</td>
              <td className="px-4 py-3 text-slate-700">{row.firm_name ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {row.approval_status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {formatMoney(row.check_size_min)} – {formatMoney(row.check_size_max)}
              </td>
              <td className="px-4 py-3 text-slate-700">{row.preferred_sectors?.join(", ") || "—"}</td>
              <td className="px-4 py-3 text-slate-700">{row.preferred_geographies?.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminInvestorsModuleViewsInner({
  investorProfiles,
  investorActivity,
  investorAuthProfiles,
  subscriptionMap,
  requestedPlansMap,
  profileLookup,
  investors,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useMemo(() => parseInvestorsPageView(searchParams.get("view")), [searchParams]);

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

  function replaceParams(patch: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
      <InvestorsPageToolbar
        view={view}
        onViewChange={(next) => replaceParams({ view: next })}
        filters={investorFilters}
        onFilterChange={(patch) =>
          replaceParams({
            q: patch.q ?? undefined,
            approval_status: patch.approvalStatus ?? undefined,
            type: patch.type ?? undefined,
            sector: patch.sector ?? undefined,
            checkSize: patch.checkSize != null ? String(patch.checkSize) : undefined,
          })
        }
        onClearFilters={() =>
          replaceParams({
            q: null,
            status: null,
            approval_status: null,
            type: null,
            sector: null,
            checkSize: null,
          })
        }
      />

      <AdminQueryFilterBar page="investors" className="mb-4" />

      {view === "table" ? (
        <WorkspacePanel title="All investors" subtitle={`${filteredProfiles.length} onboarding records`}>
          {filteredProfiles.length === 0 ? (
            <ModuleEmptyState title="No matching investors" description="Try clearing filters or adjusting the search term." />
          ) : (
            <InvestorProfilesTable rows={filteredProfiles} />
          )}
        </WorkspacePanel>
      ) : null}

      {view === "approval" ? (
        <>
          {(["submitted", "changes_requested", "approved", "rejected", "draft"] as const).map((status) => {
            const rows = filteredProfiles.filter((row) => row.approval_status === status);
            return (
              <div key={status} className="mt-6">
                <WorkspacePanel title={status.replaceAll("_", " ")} subtitle={`${rows.length} profiles`}>
                  {rows.length === 0 ? (
                    <p className="text-sm text-slate-600">No profiles.</p>
                  ) : (
                    <div className="grid gap-5">
                      {rows.map((row) => (
                        <AdminInvestorReviewCard key={row.id} row={row} />
                      ))}
                    </div>
                  )}
                </WorkspacePanel>
              </div>
            );
          })}
        </>
      ) : null}

      {view === "segments" ? (
        <>
          <WorkspacePanel title="By investor type" subtitle={`${filteredProfiles.length} profiles`}>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from(
                filteredProfiles.reduce((acc, row) => {
                  const key = row.investor_type ?? "unknown";
                  acc.set(key, (acc.get(key) ?? 0) + 1);
                  return acc;
                }, new Map<string, number>()),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{count}</p>
                  </div>
                ))}
            </div>
          </WorkspacePanel>

          <div className="mt-8">
            <WorkspacePanel title="By sector (top)" subtitle="Based on preferred sectors">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from(
                  filteredProfiles.reduce((acc, row) => {
                    for (const sector of row.preferred_sectors ?? []) {
                      const key = String(sector || "").trim();
                      if (!key) continue;
                      acc.set(key, (acc.get(key) ?? 0) + 1);
                    }
                    return acc;
                  }, new Map<string, number>()),
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 18)
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <span className="font-medium text-slate-900">{key}</span>
                      <span className="text-xs text-slate-500">{count}</span>
                    </div>
                  ))}
              </div>
            </WorkspacePanel>
          </div>

          <div className="mt-8">
            <WorkspacePanel title="By geography (top)" subtitle="Based on preferred geographies">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from(
                  filteredProfiles.reduce((acc, row) => {
                    for (const geo of row.preferred_geographies ?? []) {
                      const key = String(geo || "").trim();
                      if (!key) continue;
                      acc.set(key, (acc.get(key) ?? 0) + 1);
                    }
                    return acc;
                  }, new Map<string, number>()),
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 18)
                  .map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <span className="font-medium text-slate-900">{key}</span>
                      <span className="text-xs text-slate-500">{count}</span>
                    </div>
                  ))}
              </div>
            </WorkspacePanel>
          </div>
        </>
      ) : null}

      {view === "activity" ? (
        <>
          <WorkspacePanel title="Investor directory (latest activity)" subtitle={`${investors.length} investors with recorded activity`}>
            {investors.length === 0 ? (
              <p className="text-sm text-slate-600">No investor activity yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {investors.map((investor) => (
                  <div key={`${investor.email ?? investor.name}`} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{investor.name}</p>
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

          <div className="mt-8">
            <AdminInvestorActivity
              interests={investorActivity.interests}
              introRequests={investorActivity.introRequests}
              savedDeals={investorActivity.savedDeals}
            />
          </div>
        </>
      ) : null}

      {view === "cards" ? (
        <>
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
                        <p className="font-medium text-slate-900">
                          {investor.full_name ?? investor.email ?? "Investor"}
                        </p>
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
                    <div
                      key={`${investor.email ?? investor.name}`}
                      className="flex items-center justify-between py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{investor.name}</p>
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
      ) : null}
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
