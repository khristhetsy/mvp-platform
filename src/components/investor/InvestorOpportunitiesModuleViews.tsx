"use client";

import { Suspense, useMemo, useState } from "react";
import { InvestorMatchOpportunityCard } from "@/components/InvestorMatchOpportunityCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ModuleEmptyState, PipelineBoard } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";

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
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterMatches(matches, query), [matches, query]);

  const pipelineColumns = useMemo(() => {
    const buckets = {
      high: [] as InvestorOpportunityRow[],
      medium: [] as InvestorOpportunityRow[],
      low: [] as InvestorOpportunityRow[],
    };
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
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies, sector, or stage…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <PageSection
        title="Recommended for you"
        subtitle="Sorted by CapitalOS match score (sector, stage, check size, geography, readiness)"
      >
        {filtered.length === 0 ? (
          <ModuleEmptyState
            title="No matching opportunities"
            description="Adjust your search or browse the full marketplace."
          />
        ) : (
          <PipelineBoard columns={pipelineColumns} density="comfortable" />
        )}
      </PageSection>
    </>
  );
}

export function InvestorOpportunitiesModuleViews(props: Readonly<{ matches: InvestorOpportunityRow[] }>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading opportunities…</p>}>
      <InvestorOpportunitiesModuleViewsInner {...props} />
    </Suspense>
  );
}
