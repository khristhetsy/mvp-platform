"use client";

import Link from "next/link";

import { useTranslations } from "next-intl";
import { Fragment, Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminInvestorReviewCard } from "@/components/AdminInvestorReviewCard";
import { AdminSubscriptionSummary } from "@/components/AdminSubscriptionSummary";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatUsd } from "@/lib/ui/format-display";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { PlanType, SubscriptionRecord } from "@/lib/subscriptions/plans";
import type { InvestorProfileRecord } from "@/lib/investor/types";
import type { KycReviewItem } from "@/lib/investor/kyc";
import type { InvestorPriorDealRecord } from "@/lib/investor/types";
import { filterInvestorProfiles, type InvestorQueryFilters } from "@/lib/ui/query-filters";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";
import { investorApprovalStatusLabel } from "@/lib/investor/access";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState, type QuickFilter, type GroupOption } from "@/components/admin/OdooSearchBar";
import { CompaniesGear } from "@/components/admin/companies/CompaniesGear";
import { CompaniesPlanDonut, type PlanSlice } from "@/components/admin/companies/CompaniesPlanDonut";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { Highlight } from "@/components/ui/SearchStatus";

type InvestorsPageView = "cards" | "table" | "approval" | "segments" | "activity";

function parseInvestorsPageView(raw: string | null): InvestorsPageView {
  switch ((raw ?? "").toLowerCase()) {
    case "cards":
    case "approval":
    case "segments":
    case "activity":
      return raw as InvestorsPageView;
    case "table":
    default:
      return "table";
  }
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return formatUsd(value);
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

type InvestorSliceKey = "approved" | "pending" | "other";

const SLICE_META: Record<InvestorSliceKey, { label: string; color: string }> = {
  approved: { label: "Approved", color: "#1D9E75" },
  pending: { label: "Pending review", color: "#EF9F27" },
  other: { label: "Draft or rejected", color: "#CBD5E1" },
};

function investorSlice(row: { approval_status: string }): InvestorSliceKey {
  if (row.approval_status === "approved") return "approved";
  if (row.approval_status === "submitted" || row.approval_status === "changes_requested") return "pending";
  return "other";
}

const INVESTOR_QUICK: QuickFilter[] = [
  { key: "pending", label: "Pending review" },
  { key: "approved", label: "Approved" },
  { key: "match70", label: "Best match 70 or more", sep: true },
];

const INVESTOR_GROUPS: GroupOption[] = [
  { id: "none", label: "No grouping" },
  { id: "type", label: "Investor type" },
  { id: "status", label: "Approval status" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "individual", label: "Individual" },
  { value: "angel_group", label: "Angel group" },
  { value: "family_office", label: "Family office" },
  { value: "venture_fund", label: "Venture fund" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
];

const INVESTOR_SEARCH_FIELDS: SearchField<InvestorProfileWithMatching>[] = [
  { label: "investor", get: (r) => r.profiles?.full_name },
  { label: "email", get: (r) => r.profiles?.email },
  { label: "firm", get: (r) => r.firm_name },
  { label: "type", get: (r) => r.investor_type },
  { label: "approval", get: (r) => r.approval_status },
  { label: "sectors", get: (r) => (r.preferred_sectors ?? []).join(" ") },
  { label: "geographies", get: (r) => (r.preferred_geographies ?? []).join(" ") },
];

function scoreClass(n: number | null | undefined) {
  if (n == null) return "text-slate-400";
  if (n >= 70) return "text-emerald-700 font-semibold";
  if (n >= 50) return "text-amber-700 font-semibold";
  return "text-red-600 font-semibold";
}

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-700",
  submitted: "bg-amber-50 text-amber-800",
  changes_requested: "bg-amber-50 text-amber-800",
  draft: "bg-slate-100 text-slate-600",
};

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: PLATFORM_TZ });
}

function groupRows(rows: InvestorProfileWithMatching[], groupBy: string) {
  if (groupBy !== "type" && groupBy !== "status") return rows.map((row) => ({ header: null as string | null, count: 0, row }));
  const keyOf = (r: InvestorProfileWithMatching) =>
    groupBy === "type" ? (r.investor_type ?? "Unknown").replaceAll("_", " ") : investorApprovalStatusLabel(r.approval_status);
  const buckets = new Map<string, InvestorProfileWithMatching[]>();
  for (const r of rows) buckets.set(keyOf(r), [...(buckets.get(keyOf(r)) ?? []), r]);
  return [...buckets.entries()].flatMap(([header, list]) => [
    { header: header as string | null, count: list.length, row: null as InvestorProfileWithMatching | null },
    ...list.map((row) => ({ header: null as string | null, count: 0, row })),
  ]);
}

function InvestorProfilesTable({
  rows,
  query,
  groupBy,
}: Readonly<{ rows: InvestorProfileWithMatching[]; query: string; groupBy: string }>) {
  // Review opens the existing review card under the row, so approve, request
  // changes and KYC all keep working from this table.
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[980px] text-sm [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:align-middle">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <th className="px-3 py-2.5">Investor</th>
            <th className="px-3 py-2.5">Type</th>
            <th className="px-3 py-2.5">Check size</th>
            <th className="px-3 py-2.5">Sectors</th>
            <th className="px-3 py-2.5 text-right">Best match</th>
            <th className="px-3 py-2.5 text-right">Matches 70%+</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Submitted</th>
            <th className="px-3 py-2.5">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groupRows(rows, groupBy).map(({ header, count, row }) => {
            if (header) {
              return (
                <tr key={`g:${header}`} className="bg-slate-50">
                  <td colSpan={9} className="px-3 py-2 text-xs font-semibold capitalize text-slate-700">
                    {header} <span className="font-normal text-slate-400">({count})</span>
                  </td>
                </tr>
              );
            }
            if (!row) return null;
            const open = openId === row.id;
            const sectors = row.preferred_sectors ?? [];
            const top = row.matchingSummary?.topMatchScore ?? null;
            const pending = investorSlice(row) === "pending";
            return (
              <Fragment key={row.id}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(open ? null : row.id)}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-900">
                      <Highlight text={row.profiles?.full_name ?? row.profiles?.email ?? "Investor"} query={query} />
                    </p>
                    {row.profiles?.email ? <p className="text-xs text-slate-500"><Highlight text={row.profiles.email} query={query} /></p> : null}
                    {row.firm_name ? <p className="text-xs text-slate-500"><Highlight text={`Firm: ${row.firm_name}`} query={query} /></p> : null}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-slate-600">{(row.investor_type ?? "—").replaceAll("_", " ")}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                    {formatMoney(row.check_size_min)} – {formatMoney(row.check_size_max)}
                  </td>
                  <td className="px-3 py-2.5">
                    {sectors.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {sectors.slice(0, 2).map((sector) => (
                          <span key={sector} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{sector}</span>
                        ))}
                        {sectors.length > 2 ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500" title={sectors.slice(2).join(", ")}>+{sectors.length - 2}</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${scoreClass(top)}`}>{top != null ? `${top}%` : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{row.matchingSummary?.highMatchCompanyCount ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[row.approval_status] ?? "bg-slate-100 text-slate-600"}`}>
                      {investorApprovalStatusLabel(row.approval_status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{formatShortDate(row.created_at ?? row.profiles?.created_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : row.id); }}
                        className={
                          pending
                            ? "rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                            : "rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                        }
                      >
                        {pending ? "Approve" : "Review"}
                      </button>
                      <span className="text-xs text-indigo-600">{open ? "↑" : "→"}</span>
                    </div>
                  </td>
                </tr>
                {open ? (
                  <tr className="bg-slate-50/60">
                    <td colSpan={9} className="px-3 py-4">
                      <AdminInvestorReviewCard row={row} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
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
  const t = useTranslations("adminCmp");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useMemo(() => parseInvestorsPageView(searchParams.get("view")), [searchParams]);

  const { filters } = useAdminQueryFilters("investors");
  const investorFilters = filters as InvestorQueryFilters;

  const [showArchived, setShowArchived] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const query = searchState.q;
  const [slice, setSlice] = useState<InvestorSliceKey | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const archivedCount = useMemo(
    () => investorProfiles.filter((row) => Boolean(row.archived_at)).length,
    [investorProfiles],
  );

  // URL drilldown filters first, then the search bar, quick filters, circle graph and gear.
  const drilldown = useMemo(
    () => filterInvestorProfiles(investorProfiles, { ...investorFilters, q: "" }, profileLookup),
    [investorProfiles, investorFilters, profileLookup],
  );
  const search = useMemo(() => matchRows(drilldown, INVESTOR_SEARCH_FIELDS, query), [drilldown, query]);
  const sectorOptions = useMemo(
    () => [...new Set(investorProfiles.flatMap((row) => row.preferred_sectors ?? []))].sort(),
    [investorProfiles],
  );

  const filteredProfiles = useMemo(() => {
    const quick = new Set(searchState.quick);
    const sectors = searchState.fields.sector ?? [];
    return search.rows.filter((row) => {
      if (showArchived ? !row.archived_at : Boolean(row.archived_at)) return false;
      if (slice && investorSlice(row) !== slice) return false;
      if (typeFilter && row.investor_type !== typeFilter) return false;
      if (statusFilter && row.approval_status !== statusFilter) return false;
      if (sectors.length && !(row.preferred_sectors ?? []).some((item) => sectors.includes(item))) return false;
      if (quick.has("pending") && investorSlice(row) !== "pending") return false;
      if (quick.has("approved") && row.approval_status !== "approved") return false;
      if (quick.has("match70") && !((row.matchingSummary?.topMatchScore ?? 0) >= 70)) return false;
      return true;
    });
  }, [search.rows, showArchived, slice, typeFilter, statusFilter, searchState.quick, searchState.fields]);

  // Circle graph: active (not archived) investors by approval state.
  const sliceTotals = useMemo<PlanSlice<InvestorSliceKey>[]>(() => {
    const active = investorProfiles.filter((row) => !row.archived_at);
    return (["approved", "pending", "other"] as const).map((key) => ({
      key,
      ...SLICE_META[key],
      count: active.filter((row) => investorSlice(row) === key).length,
    }));
  }, [investorProfiles]);
  const activeCount = sliceTotals.reduce((sum, item) => sum + item.count, 0);

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
    investorFilters.q.trim().length > 0 ||
    query.trim().length > 0 ||
    Boolean(slice || typeFilter || statusFilter) ||
    searchState.quick.length > 0;

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
      <CompaniesPlanDonut
        slices={sliceTotals}
        mrr={String(activeCount)}
        centerLabel="INVESTORS"
        totalLabel="Investor accounts"
        noun="investors"
        alwaysShowKeys={["approved", "pending"]}
        active={slice}
        onSelect={setSlice}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)]">
        <CompaniesGear
          sections={[
            {
              title: "Investor type",
              value: typeFilter,
              onChange: setTypeFilter,
              options: TYPE_OPTIONS,
            },
            {
              title: "Approval status",
              value: statusFilter,
              onChange: setStatusFilter,
              options: STATUS_OPTIONS,
            },
            {
              title: "View",
              value: view,
              onChange: (next) => replaceParams({ view: next }),
              options: [
                { value: "table", label: "Table" },
                { value: "cards", label: "Cards" },
                { value: "approval", label: "Approval" },
                { value: "segments", label: "Segments" },
                { value: "activity", label: "Activity" },
              ],
            },
          ]}
        />
        <div className="min-w-0 flex-1 max-sm:order-last max-sm:col-span-2">
          <OdooSearchBar
            scope="admin_investors"
            state={searchState}
            onChange={setSearchState}
            quick={INVESTOR_QUICK}
            fields={[{ key: "sector", label: "Sector", options: sectorOptions }]}
            groups={INVESTOR_GROUPS}
            noGroupId="none"
            placeholder={t("search_investors")}
            width="100%"
          />
        </div>
      </div>

      <AdminQueryFilterBar page="investors" className="mb-4" />

      {(archivedCount > 0 || showArchived) && (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {showArchived ? "← Back to active investors" : `Show archived (${archivedCount})`}
          </button>
          {showArchived && (
            <span className="text-xs text-slate-500">Archived investors are hidden from the default list. Use Restore on a card to bring one back.</span>
          )}
        </div>
      )}

      {view === "table" ? (
        <WorkspacePanel title={t("all_investors")} subtitle={`${filteredProfiles.length} onboarding records`}>
          {filteredProfiles.length === 0 ? (
            <ModuleEmptyState title={t("no_matching_investors")} description={t("try_clearing_filters_or_adjusting_the_search")} />
          ) : (
            <InvestorProfilesTable rows={filteredProfiles} query={query} groupBy={searchState.groupBy} />
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
                    <p className="text-sm text-slate-600">{t("no_profiles")}</p>
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
          <WorkspacePanel title={t("by_investor_type")} subtitle={`${filteredProfiles.length} profiles`}>
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
            <WorkspacePanel title={t("by_sector_top")} subtitle={t("based_on_preferred_sectors")}>
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
            <WorkspacePanel title={t("by_geography_top")} subtitle={t("based_on_preferred_geographies")}>
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
          <WorkspacePanel title={t("investor_directory_latest_activity")} subtitle={`${investors.length} investors with recorded activity`}>
            {investors.length === 0 ? (
              <p className="text-sm text-slate-600">{t("no_investor_activity_yet")}</p>
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
                        ? new Date(investor.lastSeen).toLocaleDateString("en-US", { timeZone: PLATFORM_TZ })
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
            title={t("investor_approval_queue")}
            subtitle={`${pendingQueue.length} profiles awaiting review`}
          >
            {pendingQueue.length === 0 ? (
              hasDrilldown ? (
                <ModuleEmptyState
                  title={t("no_matching_investor_approvals")}
                  description={t("try_clearing_filters_or_adjusting_the_approv")}
                />
              ) : (
                <p className="text-sm text-slate-600">{t("no_investor_profiles_pending_approval")}</p>
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
              title={t("all_investor_profiles")}
              subtitle={`${filteredProfiles.length} onboarding records`}
            >
              {remainingProfiles.length === 0 ? (
                hasDrilldown ? (
                  <ModuleEmptyState
                    title={t("no_matching_investor_profiles")}
                    description={t("try_clearing_filters_or_adjusting_the_search")}
                  />
                ) : (
                  <p className="text-sm text-slate-600">{t("no_additional_investor_profiles")}</p>
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
              title={t("investor_subscriptions")}
              subtitle={`${investorAuthProfiles.length} investor auth profiles`}
            >
              {investorAuthProfiles.length === 0 ? (
                <p className="text-sm text-slate-600">{t("no_investor_profiles_yet")}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {investorAuthProfiles.map((investor) => (
                    <div key={investor.id} className="grid gap-3 py-4 md:grid-cols-[1fr_1.2fr]">
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">
                          {investor.full_name ?? investor.email ?? "Investor"}
                        </p>
                        {investor.email ? <p className="text-slate-500">{investor.email}</p> : null}
                        <Link href={`/admin/investors/${investor.id}/reach`} className="text-xs font-semibold text-indigo-600 hover:underline">
                          Investor reach
                        </Link>
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
              title={t("investor_directory")}
              subtitle={`${investors.length} investors with recorded activity`}
            >
              {investors.length === 0 ? (
                <p className="text-sm text-slate-600">{t("no_investor_activity_yet")}</p>
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
                          ? new Date(investor.lastSeen).toLocaleDateString("en-US", { timeZone: PLATFORM_TZ })
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
  const t = useTranslations("adminCmp");
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">{t("loading_filters")}</p>}>
      <AdminInvestorsModuleViewsInner {...props} />
    </Suspense>
  );
}
