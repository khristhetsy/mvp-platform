"use client";

import { useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { FounderInvestorMatchCard } from "@/components/founder/FounderInvestorMatchCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ContentGrid, PageSection } from "@/components/ui/workspace-layout";
import {
  filterFounderMatchingRows,
  formatMatchingCheckSize,
  type FounderMatchingCenterSnapshot,
  type MatchingCenterFilters,
} from "@/lib/matching/matching-center";

const defaultFilters: MatchingCenterFilters = {
  industry: "",
  investorType: "",
  geography: "",
  minScore: 0,
  maxScore: 100,
};

export function FounderMatchingCenterPanel({ snapshot }: Readonly<{ snapshot: FounderMatchingCenterSnapshot }>) {
  const [filters, setFilters] = useState(defaultFilters);

  const filteredMatches = useMemo(
    () => filterFounderMatchingRows(snapshot.matches, filters),
    [snapshot.matches, filters],
  );

  return (
    <>
      <ContentGrid columns={3} className="mb-6">
        <MetricCard
          label="Strong matches"
          value={String(snapshot.strongMatchCount)}
          detail="Approved investors scoring 70% or higher"
          accent="indigo"
          status={snapshot.strongMatchCount > 0 ? "success" : "neutral"}
        />
        <MetricCard
          label="Approved investors"
          value={String(snapshot.approvedInvestorCount)}
          detail="In the CapitalOS matching pool"
          accent="violet"
        />
        <MetricCard
          label="Your profile"
          value={snapshot.industry ?? "Not set"}
          detail={[snapshot.companyGeography, `${filteredMatches.length} matches shown`].filter(Boolean).join(" · ")}
          accent="blue"
        />
      </ContentGrid>

      <WorkspacePanel title="Filters" subtitle="Industry, investor type, geography, and score range" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600">
            Industry
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.industry}
              onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
            >
              <option value="">All sectors</option>
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
      </WorkspacePanel>

      <PageSection
        title="Ranked investor matches"
        subtitle={`Sorted by CapitalOS match score for ${snapshot.companyName}`}
      >
        {filteredMatches.length === 0 ? (
          <p className="text-sm text-slate-600">
            No investor matches for the current filters. Adjust filters or complete your company profile to improve fit
            signals.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredMatches.map((row) => (
              <FounderInvestorMatchCard
                key={row.investorId}
                investorId={row.investorId}
                investorName={row.investorName}
                investorType={row.investorType}
                geographies={row.geographies}
                checkSizeLabel={formatMatchingCheckSize(row.checkSizeMin, row.checkSizeMax)}
                matchScore={row.matchScore}
                matchReasons={row.matchReasons}
                missingFitReasons={row.missingFitReasons}
              />
            ))}
          </div>
        )}
      </PageSection>
    </>
  );
}
