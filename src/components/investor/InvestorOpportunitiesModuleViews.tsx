"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { InvestorMatchOpportunityCard } from "@/components/InvestorMatchOpportunityCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { ModuleEmptyState, PipelineBoard, ViewToolbar } from "@/components/ui/ViewToolbar";
import { ContentGrid, PageSection } from "@/components/ui/workspace-layout";
import { useViewMode } from "@/hooks/use-view-mode";

export type InvestorOpportunityRow = {
  companyId: string;
  companyName: string;
  slug: string | null;
  industry: string | null;
  stage: string | null;
  location: string | null;
  fundingTarget: string | null;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
};

function scoreBucket(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function filterMatches(rows: InvestorOpportunityRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.companyName.toLowerCase().includes(q) ||
      (row.industry?.toLowerCase().includes(q) ?? false) ||
      (row.stage?.toLowerCase().includes(q) ?? false) ||
      (row.location?.toLowerCase().includes(q) ?? false),
  );
}

function InvestorOpportunitiesModuleViewsInner({ matches }: Readonly<{ matches: InvestorOpportunityRow[] }>) {
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } =
    useViewMode("investor-opportunities");

  const filtered = useMemo(() => filterMatches(matches, query), [matches, query]);

  const pipelineColumns = useMemo(() => {
    const buckets = { high: [] as InvestorOpportunityRow[], medium: [] as InvestorOpportunityRow[], low: [] as InvestorOpportunityRow[] };
    for (const row of filtered) {
      buckets[scoreBucket(row.matchScore)].push(row);
    }
    const renderCard = (row: InvestorOpportunityRow) => (
      <InvestorMatchOpportunityCard key={row.companyId} {...row} />
    );
    return [
      { id: "high", title: "Strong match (75%+)", subtitle: "Best fit opportunities", items: buckets.high.map(renderCard) },
      { id: "medium", title: "Moderate match (50–74%)", subtitle: "Partial alignment", items: buckets.medium.map(renderCard) },
      { id: "low", title: "Exploratory (<50%)", subtitle: "Review fit gaps", items: buckets.low.map(renderCard) },
    ];
  }, [filtered]);

  const timelineRows = useMemo(
    () => [...filtered].sort((a, b) => b.matchScore - a.matchScore),
    [filtered],
  );

  if (matches.length === 0) {
    return (
      <WorkspacePanel title="Recommended for you" subtitle="Sorted by CapitalOS match score">
        <p className="text-sm text-slate-600">
          No marketplace listings available yet, or complete investor onboarding to improve match quality.
        </p>
      </WorkspacePanel>
    );
  }

  return (
    <>
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search companies, sector, or stage…"
        sticky
      />

      <PageSection
        title="Recommended for you"
        subtitle="Sorted by CapitalOS match score (sector, stage, check size, geography, readiness)"
      >
        {filtered.length === 0 ? (
          <ModuleEmptyState title="No matching opportunities" description="Adjust your search or browse the full marketplace." />
        ) : null}

        {filtered.length > 0 && viewMode === "card" ? (
          <ContentGrid columns={2}>
            {filtered.map((row) => (
              <InvestorMatchOpportunityCard key={row.companyId} {...row} />
            ))}
          </ContentGrid>
        ) : null}

        {filtered.length > 0 && viewMode === "table" ? (
          <div className="overflow-x-auto">
            <DataTable density={density}>
              <DataTableHead>
                <DataTableHeaderCell>Company</DataTableHeaderCell>
                <DataTableHeaderCell>Sector / stage</DataTableHeaderCell>
                <DataTableHeaderCell>Location</DataTableHeaderCell>
                <DataTableHeaderCell>Target raise</DataTableHeaderCell>
                <DataTableHeaderCell>Match</DataTableHeaderCell>
                <DataTableHeaderCell>Top reasons</DataTableHeaderCell>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow key={row.companyId}>
                    <DataTableCell>
                      <Link href={row.slug ? `/deals/${row.slug}` : "/deals"} className="font-medium text-[var(--navy)] hover:underline">
                        {row.companyName}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{[row.industry, row.stage].filter(Boolean).join(" · ") || "—"}</DataTableCell>
                    <DataTableCell>{row.location ?? "—"}</DataTableCell>
                    <DataTableCell>{row.fundingTarget ?? "—"}</DataTableCell>
                    <DataTableCell>
                      <span className="font-semibold text-[var(--navy)]">{row.matchScore}%</span>
                    </DataTableCell>
                    <DataTableCell className="max-w-xs truncate text-xs">{row.matchReasons.slice(0, 2).join("; ") || "—"}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        ) : null}

        {filtered.length > 0 && viewMode === "pipeline" ? (
          <PipelineBoard columns={pipelineColumns} density={density} />
        ) : null}

        {filtered.length > 0 && viewMode === "timeline" ? (
          <ol className="space-y-3">
            {timelineRows.map((row, index) => (
              <li key={row.companyId} className="flex gap-3 rounded-lg border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--navy)]">{row.companyName}</p>
                  <p className="text-xs text-slate-500">{row.matchScore}% match · {row.matchReasons[0] ?? "Ranked opportunity"}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </PageSection>
    </>
  );
}

export function InvestorOpportunitiesModuleViews(props: Readonly<{ matches: InvestorOpportunityRow[] }>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <InvestorOpportunitiesModuleViewsInner {...props} />
    </Suspense>
  );
}
