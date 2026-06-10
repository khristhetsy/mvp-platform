"use client";

import { Suspense, useMemo } from "react";
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
import { ModuleEmptyState, PipelineBoard, ViewToolbar } from "@/components/ui/ViewToolbar";
import { MetricGrid, PageSection } from "@/components/ui/workspace-layout";
import { useViewMode } from "@/hooks/use-view-mode";
import type { FounderInvestorCrmView, FounderInvestorRelationRow } from "@/lib/data/investor-crm";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPipelineStage(stage: string | null) {
  if (!stage) return "—";
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAmountRow(row: FounderInvestorRelationRow) {
  if (row.pledgeAmount != null && row.pledgeAmount > 0) {
    return formatPledgeTotal(row.pledgeAmount, row.pledgeCurrency ?? "USD");
  }
  if (row.interestAmount != null && row.interestAmount > 0) {
    return formatPledgeTotal(row.interestAmount, row.pledgeCurrency ?? "USD");
  }
  return "—";
}

function FounderInvestorRelationCard({ row }: Readonly<{ row: FounderInvestorRelationRow }>) {
  const amount = formatAmountRow(row);
  const pipelineStage = row.pipelineStage ? formatPipelineStage(row.pipelineStage) : null;

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{row.investorName}</p>
          {row.investorEmail ? <p className="text-xs text-slate-500">{row.investorEmail}</p> : null}
        </div>
        <p className="text-xs text-slate-500">{formatActivityDate(row.lastActivityAt)}</p>
      </div>
      <p className="mt-2 text-sm text-slate-700">{row.actionLabel}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {row.status ? <span>Status: {row.status}</span> : null}
        {pipelineStage ? <span>Stage: {pipelineStage}</span> : null}
        {amount !== "—" ? <span>Amount: {amount}</span> : null}
      </div>
      {row.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{row.notes}</p> : null}
    </div>
  );
}

function collectAllRows(crmView: FounderInvestorCrmView): FounderInvestorRelationRow[] {
  const seen = new Set<string>();
  const rows: FounderInvestorRelationRow[] = [];
  for (const section of Object.values(crmView.sections)) {
    for (const row of section) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        rows.push(row);
      }
    }
  }
  return rows;
}

function filterRows(rows: FounderInvestorRelationRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.investorName.toLowerCase().includes(q) ||
      (row.investorEmail?.toLowerCase().includes(q) ?? false) ||
      row.actionLabel.toLowerCase().includes(q) ||
      (row.status?.toLowerCase().includes(q) ?? false),
  );
}

function FounderInvestorsModuleViewsInner({
  crmView,
  companyName,
}: Readonly<{ crmView: FounderInvestorCrmView; companyName: string }>) {
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } =
    useViewMode("founder-investors");

  const allRows = useMemo(() => collectAllRows(crmView), [crmView]);
  const filteredRows = useMemo(() => filterRows(allRows, query), [allRows, query]);

  const cardSections = useMemo(
    () => [
      { title: "New Interest", subtitle: "Investors who recently expressed interest", rows: crmView.sections.newInterest },
      { title: "Pledged / Indicative Interest", subtitle: "Investors with pledge or indicative amounts", rows: crmView.sections.pledged },
      { title: "Intro Requested", subtitle: "Investors requesting a warm introduction", rows: crmView.sections.introRequested },
      { title: "Follow-up Needed", subtitle: "Investors waiting on follow-up", rows: crmView.sections.followUpNeeded },
    ],
    [crmView.sections],
  );

  const pipelineColumns = useMemo(() => {
    const groups: Record<string, FounderInvestorRelationRow[]> = {
      interested: [],
      pledged: [],
      intro_requested: [],
      follow_up: [],
      other: [],
    };
    for (const row of filteredRows) {
      if (row.actionType === "interested" || row.actionType === "saved_deal") {
        groups.interested.push(row);
      } else if (row.actionType === "pledged" || row.actionType === "indicative_interest") {
        groups.pledged.push(row);
      } else if (row.actionType === "intro_requested") {
        groups.intro_requested.push(row);
      } else if (row.actionType === "follow_up") {
        groups.follow_up.push(row);
      } else {
        groups.other.push(row);
      }
    }
    return [
      { id: "interested", title: "Interested", items: groups.interested.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
      { id: "pledged", title: "Pledged / Indicative", items: groups.pledged.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
      { id: "intro", title: "Intro Requested", items: groups.intro_requested.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
      { id: "follow_up", title: "Follow-up", items: groups.follow_up.map((r) => <FounderInvestorRelationCard key={r.id} row={r} />) },
    ];
  }, [filteredRows]);

  const timelineRows = useMemo(
    () => [...filteredRows].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [filteredRows],
  );

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
        searchPlaceholder="Search investors, status, or activity…"
        sticky
      />

      <PageSection title="Pipeline summary" subtitle={companyName}>
        <MetricGrid>
          <MetricCard
            label="Interested investors"
            value={String(crmView.summary.totalInterestedInvestors)}
            detail="Unique investors with interest, saves, or intro activity"
            accent="indigo"
          />
          <MetricCard
            label="Pledged / indicative"
            value={crmView.summary.totalPledgedDisplay}
            detail={
              crmView.summary.totalIndicativeInterestDisplay
                ? `${crmView.summary.totalIndicativeInterestDisplay} indicative interest declared`
                : "Total pledged amount from investor interests"
            }
            accent="violet"
          />
          <MetricCard
            label="Intro requests"
            value={String(crmView.summary.introRequests)}
            detail="Investors who requested an introduction"
            accent="blue"
          />
          <MetricCard
            label="Follow-ups needed"
            value={String(crmView.summary.followUpsNeeded)}
            detail="Investors waiting on founder or platform follow-up"
            accent="slate"
          />
        </MetricGrid>
      </PageSection>

      <PageSection>
        {viewMode === "table" ? (
          filteredRows.length === 0 ? (
            <ModuleEmptyState title="No matching investors" description="Try adjusting your search or check back when platform activity arrives." />
          ) : (
            <DataTable density={density}>
              <DataTableHead>
                <DataTableHeaderCell>Investor</DataTableHeaderCell>
                <DataTableHeaderCell>Activity</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell>Stage</DataTableHeaderCell>
                <DataTableHeaderCell>Amount</DataTableHeaderCell>
                <DataTableHeaderCell>Last activity</DataTableHeaderCell>
              </DataTableHead>
              <DataTableBody>
                {filteredRows.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <p className="font-medium text-slate-900">{row.investorName}</p>
                      {row.investorEmail ? <p className="text-xs text-slate-500">{row.investorEmail}</p> : null}
                    </DataTableCell>
                    <DataTableCell>{row.actionLabel}</DataTableCell>
                    <DataTableCell>{row.status ?? "—"}</DataTableCell>
                    <DataTableCell>{formatPipelineStage(row.pipelineStage)}</DataTableCell>
                    <DataTableCell>{formatAmountRow(row)}</DataTableCell>
                    <DataTableCell>{formatActivityDate(row.lastActivityAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )
        ) : null}

        {viewMode === "card" ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {cardSections.map((section) => (
              <WorkspacePanel key={section.title} title={section.title} subtitle={section.subtitle}>
                {section.rows.length === 0 ? (
                  <p className="text-sm text-slate-500">No records in this section yet.</p>
                ) : (
                  <div className="space-y-3">
                    {section.rows.map((row) => (
                      <FounderInvestorRelationCard key={row.id} row={row} />
                    ))}
                  </div>
                )}
              </WorkspacePanel>
            ))}
          </div>
        ) : null}

        {viewMode === "pipeline" ? (
          <PipelineBoard columns={pipelineColumns} density={density} />
        ) : null}

        {viewMode === "timeline" ? (
          filteredRows.length === 0 ? (
            <ModuleEmptyState title="No activity yet" description={`Investor timeline for ${companyName} will populate as engagement grows.`} />
          ) : (
            <WorkspacePanel title="Activity timeline" subtitle="Chronological investor engagement">
              <ol className="relative border-l border-slate-200 pl-4">
                {timelineRows.map((row) => (
                  <li key={row.id} className={`${density === "compact" ? "mb-4" : "mb-6"} ml-2`}>
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--gold)]" />
                    <p className="text-xs font-medium text-slate-500">{formatActivityDate(row.lastActivityAt)}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{row.investorName}</p>
                    <p className="text-sm text-slate-700">{row.actionLabel}</p>
                  </li>
                ))}
              </ol>
            </WorkspacePanel>
          )
        ) : null}
      </PageSection>
    </>
  );
}

export function FounderInvestorsModuleViews(props: Readonly<{ crmView: FounderInvestorCrmView; companyName: string }>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <FounderInvestorsModuleViewsInner {...props} />
    </Suspense>
  );
}
