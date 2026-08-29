"use client";

import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState, PipelineBoard } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import { filterCompanies as applyCompanyQueryFilters, type CompanyQueryFilters } from "@/lib/ui/query-filters";

type ViewMode = "kanban" | "grid" | "list" | "journey";
type UserType = "" | "founders" | "investors";
type T = (key: string, values?: Record<string, string | number>) => string;

const STAGE_ORDER = ["initialize", "qualify", "deploy", "optimize"];
const STAGE_STYLE: Record<string, string> = {
  initialize: "bg-slate-100 text-slate-600",
  qualify: "bg-blue-50 text-blue-800",
  deploy: "bg-indigo-50 text-indigo-800",
  optimize: "bg-emerald-50 text-emerald-800",
};
// Display the founder's Stage 1–4 vocabulary; engine slugs stay the filter values.
const STAGE_LABEL: Record<string, string> = {
  initialize: "Onboarding",
  qualify: "Preparation",
  deploy: "Marketing",
  optimize: "Closing",
};
function scoreClass(n: number | null | undefined) {
  if (n == null) return "text-slate-400";
  if (n >= 70) return "text-emerald-700 font-semibold";
  if (n >= 50) return "text-amber-700 font-semibold";
  return "text-red-600 font-semibold";
}

// Journey-view status chip derived from the approval + review signals already on
// the card (no new query). Mirrors the Journey-view mock.
function journeyStatus(c: AdminCompanyCardData): { label: string; cls: string } {
  if (c.stage_approval_status === "pending") return { label: "Awaiting approval", cls: "bg-indigo-50 text-indigo-700" };
  if (c.stage_approval_status === "rejected" || c.review_status === "rejected") return { label: "Rejected", cls: "bg-red-50 text-red-700" };
  if (c.review_status === "approved") return { label: "On track", cls: "bg-emerald-50 text-emerald-700" };
  return { label: "In progress", cls: "bg-slate-100 text-slate-600" };
}

function reviewStatusLabel(t: T, status: string | null) {
  if (status === "pending" || status === "approved" || status === "rejected") return t(`companies.reviewStatus.${status}`);
  return t("companies.reviewStatus.unknown");
}

function filterCompaniesBySearch(companies: AdminCompanyCardData[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return companies;
  return companies.filter(
    (c) =>
      c.company_name.toLowerCase().includes(q) ||
      (c.industry?.toLowerCase().includes(q) ?? false) ||
      (c.founder_name.toLowerCase().includes(q) ?? false) ||
      (c.review_status?.toLowerCase().includes(q) ?? false),
  );
}

function AdminCompaniesModuleViewsInner({
  companies,
  loadError,
  pendingCount,
}: Readonly<{
  companies: AdminCompanyCardData[];
  loadError: string | null;
  pendingCount: number;
}>) {
  const t = useTranslations("billingCompaniesAdmin");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [userType, setUserType] = useState<UserType>("");
  const { filters } = useAdminQueryFilters("companies");
  const companyFilters = filters as CompanyQueryFilters;

  const drilldownFiltered = useMemo(
    () => applyCompanyQueryFilters(companies, { ...companyFilters, q: "" }),
    [companies, companyFilters],
  );

  const filtered = useMemo(() => filterCompaniesBySearch(drilldownFiltered, query), [drilldownFiltered, query]);

  // Journey-stage filter + sortable score/stage columns (list view).
  const [stageFilter, setStageFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<"readiness" | "investable" | "stage" | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(key: "readiness" | "investable" | "stage") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  const listRows = useMemo(() => {
    let rows = filtered;
    if (stageFilter === "pending") rows = rows.filter((c) => c.stage_approval_status === "pending");
    else if (stageFilter) rows = rows.filter((c) => (c.journey_stage ?? "") === stageFilter);
    if (sortKey) {
      const val = (c: AdminCompanyCardData) =>
        sortKey === "stage"
          ? (c.journey_stage ? STAGE_ORDER.indexOf(c.journey_stage) : -1)
          : (sortKey === "readiness" ? c.readiness_score : c.investable_score) ?? -1;
      rows = [...rows].sort((a, b) => (sortDir === "asc" ? val(a) - val(b) : val(b) - val(a)));
    }
    return rows;
  }, [filtered, stageFilter, sortKey, sortDir]);

  const pipelineColumns = useMemo(() => {
    const byStatus = new Map<string, AdminCompanyCardData[]>();
    for (const company of filtered) {
      const key = company.review_status ?? "unknown";
      const list = byStatus.get(key) ?? [];
      list.push(company);
      byStatus.set(key, list);
    }
    const order = ["pending", "approved", "rejected", "unknown"];
    const keys = [...new Set([...order, ...byStatus.keys()])].filter((k) => byStatus.has(k));
    return keys.map((status) => ({
      id: status,
      title: reviewStatusLabel(t, status === "unknown" ? null : status),
      items: (byStatus.get(status) ?? []).map((company) => (
        <AdminCompanyCard key={company.id} company={company} />
      )),
    }));
  }, [filtered, t]);

  return (
    <>
      <AdminQueryFilterBar page="companies" className="mb-4" />
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("companies.searchPh")}
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value as UserType)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Filter by user type"
        >
          <option value="">All users</option>
          <option value="founders">Founders</option>
          <option value="investors">Investors</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Filter by journey stage"
        >
          <option value="">All stages</option>
          <option value="initialize">Onboarding</option>
          <option value="qualify">Preparation</option>
          <option value="deploy">Marketing</option>
          <option value="optimize">Closing</option>
          <option value="pending">⏳ Awaiting my approval</option>
        </select>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["kanban", "grid", "list", "journey"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "kanban" ? t("companies.kanban") : v === "grid" ? t("companies.grid") : v === "list" ? t("companies.list") : "Journey"}
            </button>
          ))}
        </div>
      </div>

      <PageSection
        title={t("companies.submissions")}
        subtitle={t("companies.countSub", { count: companies.length, pending: pendingCount })}
      >
        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            {t("companies.loadFailed", { error: loadError })}
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            {t("companies.zeroRecords")}
          </div>
        ) : userType === "investors" ? (
          <ModuleEmptyState
            title="Investor accounts live in the Investors directory"
            description="This list is company-centric. Open Directory → Investors to browse and filter investor accounts."
          />
        ) : filtered.length === 0 ? (
          <ModuleEmptyState title={t("companies.noMatching")} description={t("companies.noMatchingDesc")} />
        ) : view === "journey" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {listRows.map((company) => {
                const idx = company.journey_stage ? STAGE_ORDER.indexOf(company.journey_stage) : -1;
                const status = journeyStatus(company);
                return (
                  <li
                    key={company.id}
                    className="grid cursor-pointer grid-cols-[1.5fr_1.6fr_0.8fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    onClick={() => { window.location.href = `/admin/companies/${company.id}`; }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{company.company_name}</p>
                      <p className="truncate text-xs text-slate-500">{company.founder_name}</p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-1">
                        {STAGE_ORDER.map((s, i) => (
                          <div
                            key={s}
                            title={STAGE_LABEL[s]}
                            className={`h-1.5 flex-1 rounded ${i <= idx ? "bg-indigo-500" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {idx >= 0 ? `Stage ${idx + 1} · ${STAGE_LABEL[STAGE_ORDER[idx]]}` : "Not started"}
                      </p>
                    </div>
                    <div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
                      <p className={`mt-0.5 text-[11px] ${scoreClass(company.readiness_score)}`}>
                        {company.readiness_score != null ? `${company.readiness_score}% ready` : "—"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-indigo-600">Open →</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : view === "kanban" ? (
          <PipelineBoard columns={pipelineColumns} density="comfortable" />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((company) => (
              <AdminCompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">{t("companies.colCompany")}</th>
                  <th className="px-4 py-3">{t("companies.colFounder")}</th>
                  <th className="px-4 py-3">{t("companies.colIndustry")}</th>
                  {([["readiness", "Readiness"], ["investable", "Investable"], ["stage", "Stage"]] as const).map(([key, label]) => (
                    <th key={key} className="px-4 py-3">
                      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
                        {label}
                        <span className="text-[9px]">{sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3">{t("companies.colReview")}</th>
                  <th className="px-4 py-3">{t("companies.colPublished")}</th>
                  <th className="px-4 py-3">{t("companies.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listRows.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => { window.location.href = `/admin/companies/${company.id}`; }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{company.company_name}</td>
                    <td className="px-4 py-3 text-slate-600">{company.founder_name}</td>
                    <td className="px-4 py-3 text-slate-500">{company.industry ?? "—"}</td>
                    <td className={`px-4 py-3 ${scoreClass(company.readiness_score)}`}>
                      {company.readiness_score != null ? company.readiness_score : "—"}
                    </td>
                    <td className={`px-4 py-3 ${scoreClass(company.investable_score)}`}>
                      {company.investable_score != null ? company.investable_score : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {company.journey_stage ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_STYLE[company.journey_stage] ?? "bg-slate-100 text-slate-600"}`}>
                            {STAGE_LABEL[company.journey_stage] ?? company.journey_stage}
                          </span>
                          {company.stage_approval_status === "pending" && <span className="text-[10px] text-amber-700" title="Awaiting your approval">⏳</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        company.review_status === "approved"
                          ? "bg-emerald-50 text-emerald-800"
                          : company.review_status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                      }`}>
                        {reviewStatusLabel(t, company.review_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {company.is_published ? t("companies.published") : t("companies.draft")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {company.review_status === "pending" ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/companies/${company.id}`; }}
                            className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                          >
                            {t("companies.approve")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/companies/${company.id}`; }}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t("companies.review")}
                          </button>
                        )}
                        <span className="text-xs text-indigo-600">→</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </>
  );
}

export function AdminCompaniesModuleViews(
  props: Readonly<{
    companies: AdminCompanyCardData[];
    loadError: string | null;
    pendingCount: number;
  }>,
) {
  return (
    <Suspense fallback={<CompaniesLoadingFallback />}>
      <AdminCompaniesModuleViewsInner {...props} />
    </Suspense>
  );
}

function CompaniesLoadingFallback() {
  const t = useTranslations("billingCompaniesAdmin");
  return <p className="text-sm text-slate-500">{t("companies.loadingView")}</p>;
}
