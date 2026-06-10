"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState, PipelineBoard, ViewToolbar } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import { useViewMode } from "@/hooks/use-view-mode";
import { filterCompanies as applyCompanyQueryFilters, type CompanyQueryFilters } from "@/lib/ui/query-filters";
import { getCompanyWorkspaceHref } from "@/lib/ui/drilldown-links";

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
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } =
    useViewMode("admin-companies");
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

  const timelineRows = useMemo(
    () => [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [filtered],
  );

  return (
    <>
      <AdminQueryFilterBar page="companies" className="mb-4" />
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search companies, founders, or status…"
        sticky
      />

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
        ) : viewMode === "card" ? (
          <div className={`grid gap-4 ${density === "compact" ? "gap-3" : "gap-4"}`}>
            {filtered.map((company) => (
              <AdminCompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <DataTable density={density}>
          <DataTableHead>
            <DataTableHeaderCell>Company</DataTableHeaderCell>
            <DataTableHeaderCell>Founder</DataTableHeaderCell>
            <DataTableHeaderCell>Industry</DataTableHeaderCell>
            <DataTableHeaderCell>Review</DataTableHeaderCell>
            <DataTableHeaderCell>Published</DataTableHeaderCell>
            <DataTableHeaderCell>Onboarding</DataTableHeaderCell>
            <DataTableHeaderCell>Submitted</DataTableHeaderCell>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((company) => (
              <DataTableRow key={company.id}>
                <DataTableCell>
                  <Link href={getCompanyWorkspaceHref(company.id)} className="font-medium text-indigo-700 hover:text-indigo-900">
                    {company.company_name}
                  </Link>
                </DataTableCell>
                <DataTableCell>
                  <p>{company.founder_name}</p>
                  <p className="text-xs text-slate-500">{company.founder_email}</p>
                </DataTableCell>
                <DataTableCell>{company.industry ?? "—"}</DataTableCell>
                <DataTableCell>{formatReviewStatus(company.review_status)}</DataTableCell>
                <DataTableCell>{company.is_published ? "Yes" : "No"}</DataTableCell>
                <DataTableCell>{company.founder_onboarding_percent}%</DataTableCell>
                <DataTableCell>{new Date(company.created_at).toLocaleDateString("en-US")}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
            </DataTable>
          </div>
        ) : viewMode === "pipeline" ? (
          <PipelineBoard columns={pipelineColumns} density={density} />
        ) : (
          <ol className="space-y-3">
            {timelineRows.map((company) => (
              <li key={company.id} className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
                <p className="text-xs text-slate-500">{new Date(company.created_at).toLocaleDateString("en-US")}</p>
                <p className="text-sm font-semibold text-slate-950">{company.company_name}</p>
                <p className="text-xs text-slate-600">
                  {formatReviewStatus(company.review_status)} · {company.founder_name}
                </p>
              </li>
            ))}
          </ol>
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
