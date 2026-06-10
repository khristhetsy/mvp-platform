"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { ContentGrid, MetricGrid, PageSection } from "@/components/ui/workspace-layout";
import {
  filterMatchingCenterPairs,
  formatMatchingCheckSize,
  type AdminMatchingCenterSnapshot,
  type MatchingCenterFilters,
} from "@/lib/matching/matching-center";

function scoreClass(score: number) {
  if (score >= 70) return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (score >= 50) return "bg-amber-50 text-amber-900 ring-amber-100";
  return "bg-slate-100 text-slate-700 ring-slate-100";
}

const defaultFilters: MatchingCenterFilters = {
  industry: "",
  investorType: "",
  geography: "",
  minScore: 0,
  maxScore: 100,
};

function hasActiveFilters(filters: MatchingCenterFilters) {
  return Boolean(
    filters.industry ||
      filters.investorType ||
      filters.geography ||
      filters.minScore > 0 ||
      filters.maxScore < 100,
  );
}

export function AdminMatchingCenterPanel({ snapshot }: Readonly<{ snapshot: AdminMatchingCenterSnapshot }>) {
  const [filters, setFilters] = useState(defaultFilters);

  const filteredPairs = useMemo(() => {
    const rows = filterMatchingCenterPairs(snapshot.pairs, filters);
    return [...rows].sort((a, b) => b.matchScore - a.matchScore).slice(0, 50);
  }, [snapshot.pairs, filters]);

  const displayRows = hasActiveFilters(filters) ? filteredPairs : snapshot.recentMatches;
  const distributionMax = Math.max(1, ...snapshot.scoreDistribution.map((row) => row.count));

  return (
    <>
      <MetricGrid className="mb-6">
        <MetricCard
          label="High match pairs"
          value={String(snapshot.stats.highMatchCount)}
          detail="Investor–company pairs scoring 70% or higher"
          accent="indigo"
          status={snapshot.stats.highMatchCount > 0 ? "success" : "neutral"}
          href="/admin/matching"
        />
        <MetricCard
          label="Average match score"
          value={`${snapshot.stats.averageMatchScore}%`}
          detail={`Across ${snapshot.stats.totalPairs.toLocaleString()} marketplace pairs`}
          accent="violet"
          href="/admin/matching"
        />
        <MetricCard
          label="Marketplace companies"
          value={String(snapshot.stats.marketplaceCompanyCount)}
          detail="Published listings in matching pool"
          accent="blue"
          href="/admin/companies"
        />
        <MetricCard
          label="Approved investors"
          value={String(snapshot.stats.approvedInvestorCount)}
          detail="Eligible for CapitalOS matching"
          accent="slate"
          href="/admin/investors"
        />
      </MetricGrid>

      <ContentGrid columns={2} className="mb-6">
        <WorkspacePanel title="Match score distribution" subtitle="Marketplace investor–company pairs">
          <ul className="space-y-3">
            {snapshot.scoreDistribution.map((bucket) => (
              <li key={bucket.id}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{bucket.label}</span>
                  <span className="font-semibold text-slate-900">{bucket.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.round((bucket.count / distributionMax) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </WorkspacePanel>

        <WorkspacePanel title="Filters" subtitle="Industry, investor type, geography, and score range">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Industry
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={filters.industry}
                onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
              >
                <option value="">All industries</option>
                {snapshot.filterOptions.industries.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Investor type
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={filters.investorType}
                onChange={(event) => setFilters((current) => ({ ...current, investorType: event.target.value }))}
              >
                <option value="">All types</option>
                {snapshot.filterOptions.investorTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Geography
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={filters.geography}
                onChange={(event) => setFilters((current) => ({ ...current, geography: event.target.value }))}
              >
                <option value="">All geographies</option>
                {snapshot.filterOptions.geographies.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-600">
                Min score
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={filters.minScore}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, minScore: Number(event.target.value) || 0 }))
                  }
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Max score
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={filters.maxScore}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, maxScore: Number(event.target.value) || 100 }))
                  }
                />
              </label>
            </div>
          </div>
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              onClick={() => setFilters(defaultFilters)}
            >
              Clear filters
            </button>
          ) : null}
        </WorkspacePanel>
      </ContentGrid>

      <ContentGrid columns={2} className="mb-6">
        <PageSection title="Top matched companies" subtitle="Highest investor fit on marketplace">
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Company</DataTableHeaderCell>
                <DataTableHeaderCell>Top score</DataTableHeaderCell>
                <DataTableHeaderCell>High matches</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {snapshot.topCompanies.map((row) => (
                <DataTableRow key={row.companyId}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{row.companyName}</p>
                    <p className="text-xs text-slate-500">
                      {[row.industry, row.geography].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${scoreClass(row.topMatchScore)}`}>
                      {row.topMatchScore}%
                    </span>
                  </DataTableCell>
                  <DataTableCell>{row.highMatchInvestorCount}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </PageSection>

        <PageSection title="Top matched investors" subtitle="Strongest company alignment">
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Investor</DataTableHeaderCell>
                <DataTableHeaderCell>Top score</DataTableHeaderCell>
                <DataTableHeaderCell>High matches</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {snapshot.topInvestors.map((row) => (
                <DataTableRow key={row.investorId}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{row.investorName}</p>
                    <p className="text-xs text-slate-500">{row.investorType ?? "Investor"}</p>
                  </DataTableCell>
                  <DataTableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${scoreClass(row.topMatchScore)}`}>
                      {row.topMatchScore}%
                    </span>
                  </DataTableCell>
                  <DataTableCell>{row.highMatchCompanyCount}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </PageSection>
      </ContentGrid>

      <PageSection
        title={hasActiveFilters(filters) ? "Filtered matches" : "Recent matches"}
        subtitle={
          hasActiveFilters(filters)
            ? `${displayRows.length} pairs in current filter view`
            : "Recently published marketplace listings with moderate or strong fit"
        }
      >
        {displayRows.length === 0 ? (
          <p className="text-sm text-slate-600">No matches match the current filters.</p>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Investor</DataTableHeaderCell>
                <DataTableHeaderCell>Company</DataTableHeaderCell>
                <DataTableHeaderCell>Score</DataTableHeaderCell>
                <DataTableHeaderCell>Fit signals</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {displayRows.map((row) => (
                <DataTableRow key={`${row.investorId}-${row.companyId}`}>
                  <DataTableCell>
                    <Link href="/admin/investors" className="font-medium text-indigo-700 hover:text-indigo-600">
                      {row.investorName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[row.investorType, row.investorGeographies.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      Check size: {formatMatchingCheckSize(row.checkSizeMin, row.checkSizeMax)}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <Link href="/admin/companies" className="font-medium text-slate-900 hover:text-indigo-700">
                      {row.companyName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[row.industry, row.companyGeography].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${scoreClass(row.matchScore)}`}>
                      {row.matchScore}%
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    {row.matchReasons.length > 0 ? (
                      <p className="text-xs text-slate-700">{row.matchReasons.join(" · ")}</p>
                    ) : null}
                    {row.missingFitReasons.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">{row.missingFitReasons.slice(0, 2).join(" · ")}</p>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </PageSection>
    </>
  );
}
