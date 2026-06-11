"use client";

import { Suspense, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ModuleEmptyState, PipelineBoard } from "@/components/ui/ViewToolbar";
import { MetricGrid, PageSection } from "@/components/ui/workspace-layout";
import type { FounderInvestorCrmView, FounderInvestorRelationRow } from "@/lib/data/investor-crm";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";

type ViewMode = "kanban" | "grid" | "list";

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

const PIPELINE_GROUPS = [
  { id: "interested", title: "Interested", actionTypes: ["interested", "saved_deal"] },
  { id: "pledged", title: "Pledged / Indicative", actionTypes: ["pledged", "indicative_interest"] },
  { id: "intro", title: "Intro Requested", actionTypes: ["intro_requested"] },
  { id: "follow_up", title: "Follow-up", actionTypes: ["follow_up"] },
] as const;

function FounderInvestorsModuleViewsInner({
  crmView,
  companyName,
}: Readonly<{ crmView: FounderInvestorCrmView; companyName: string }>) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");

  const allRows = useMemo(() => collectAllRows(crmView), [crmView]);
  const filteredRows = useMemo(() => filterRows(allRows, query), [allRows, query]);

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

  const groupedForGrid = useMemo(() => {
    return PIPELINE_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      rows: filteredRows.filter((r) => (group.actionTypes as readonly string[]).includes(r.actionType)),
    })).filter((g) => g.rows.length > 0);
  }, [filteredRows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search investors, status, or activity…"
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

      <PageSection title="Pipeline summary" subtitle={companyName}>
        <MetricGrid>
          <MetricCard
            label="Interested investors"
            value={String(crmView.summary.totalInterestedInvestors)}
            detail="Unique investors with interest, saves, or intro activity"
            accent="indigo"
            href="/founder/investors"
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
            href="/founder/capital-raise"
          />
          <MetricCard
            label="Intro requests"
            value={String(crmView.summary.introRequests)}
            detail="Investors who requested an introduction"
            accent="blue"
            href="/founder/messages"
          />
          <MetricCard
            label="Follow-ups needed"
            value={String(crmView.summary.followUpsNeeded)}
            detail="Investors waiting on founder or platform follow-up"
            accent="slate"
            href="/founder/investors"
          />
        </MetricGrid>
      </PageSection>

      <PageSection>
        {filteredRows.length === 0 ? (
          <ModuleEmptyState title="No matching investors" description="Try adjusting your search or check back when platform activity arrives." />
        ) : view === "kanban" ? (
          <PipelineBoard columns={pipelineColumns} density="comfortable" />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {groupedForGrid.map((group) => (
              <WorkspacePanel key={group.id} title={group.title} subtitle={`${group.rows.length} investor${group.rows.length !== 1 ? "s" : ""}`}>
                <div className="space-y-2">
                  {group.rows.map((row) => (
                    <FounderInvestorRelationCard key={row.id} row={row} />
                  ))}
                </div>
              </WorkspacePanel>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">Investor</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.investorName}</p>
                      {row.investorEmail ? <p className="text-xs text-slate-400">{row.investorEmail}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.actionLabel}</td>
                    <td className="px-4 py-3 text-slate-500">{row.status ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{row.pipelineStage ? formatPipelineStage(row.pipelineStage) : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatAmountRow(row)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatActivityDate(row.lastActivityAt)}</td>
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

export function FounderInvestorsModuleViews(props: Readonly<{ crmView: FounderInvestorCrmView; companyName: string }>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <FounderInvestorsModuleViewsInner {...props} />
    </Suspense>
  );
}
