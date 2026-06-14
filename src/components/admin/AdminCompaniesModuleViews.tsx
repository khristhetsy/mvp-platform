"use client";

import { Suspense, useMemo, useState } from "react";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState, PipelineBoard } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import { filterCompanies as applyCompanyQueryFilters, type CompanyQueryFilters } from "@/lib/ui/query-filters";

type ViewMode = "kanban" | "grid" | "list";

function formatReviewStatus(status: string | null) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
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
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const { filters } = useAdminQueryFilters("companies");
  const companyFilters = filters as CompanyQueryFilters;

  const drilldownFiltered = useMemo(
    () => applyCompanyQueryFilters(companies, { ...companyFilters, q: "" }),
    [companies, companyFilters],
  );

  const filtered = useMemo(() => filterCompaniesBySearch(drilldownFiltered, query), [drilldownFiltered, query]);

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
      title: formatReviewStatus(status === "unknown" ? null : status),
      items: (byStatus.get(status) ?? []).map((company) => (
        <AdminCompanyCard key={company.id} company={company} />
      )),
    }));
  }, [filtered]);

  return (
    <>
      <AdminQueryFilterBar page="companies" className="mb-4" />
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies, founders, or status…"
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["kanban", "grid", "list"] as const).map((v) => (
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
              {v === "kanban" ? "⊞ Kanban" : v === "grid" ? "⊟ Grid" : "≡ List"}
            </button>
          ))}
        </div>
      </div>

      <PageSection
        title="Company submissions"
        subtitle={`${companies.length} companies · ${pendingCount} pending review`}
      >
        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            Failed to load companies: {loadError}
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            listAdminCompanies() returned 0 records. No companies in database or query returned empty.
          </div>
        ) : filtered.length === 0 ? (
          <ModuleEmptyState title="No matching companies" description="Try a different search term or clear filters." />
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
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Founder</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => { window.location.href = `/admin/companies/${company.id}`; }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{company.company_name}</td>
                    <td className="px-4 py-3 text-slate-600">{company.founder_name}</td>
                    <td className="px-4 py-3 text-slate-500">{company.industry ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        company.review_status === "approved"
                          ? "bg-emerald-50 text-emerald-800"
                          : company.review_status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                      }`}>
                        {formatReviewStatus(company.review_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {company.is_published ? "Published" : "Draft"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {company.review_status === "pending" ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/companies/${company.id}`; }}
                            className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                          >
                            Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/companies/${company.id}`; }}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Review
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
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <AdminCompaniesModuleViewsInner {...props} />
    </Suspense>
  );
}
