import { WorkspacePanel } from "@/components/WorkspacePanel";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import {
  formatChecklistCategory,
  formatSpvCurrency,
  getSpvParticipationTotals,
} from "@/lib/spv/display";
import { buildFounderSpvTimeline, type SpvOperationalReadinessStatus } from "@/lib/spv/readiness";
import type { SpvChecklistCategory, SpvOpportunityRecord, SpvParticipationRecord } from "@/lib/spv/types";

type CategorySummary = {
  category: SpvChecklistCategory;
  total: number;
  completed: number;
};

type PackageSummary = {
  complete: number;
  total: number;
  readinessPct: number;
};

export function FounderSpvStatusPanel({
  opportunities,
  participations,
  checklistSummaryBySpv,
  packageSummaryBySpv = {},
}: Readonly<{
  opportunities: SpvOpportunityRecord[];
  participations: SpvParticipationRecord[];
  checklistSummaryBySpv: Record<string, CategorySummary[]>;
  packageSummaryBySpv?: Record<string, PackageSummary>;
}>) {
  const bySpv = new Map<string, SpvParticipationRecord[]>();
  for (const row of participations) {
    const list = bySpv.get(row.spv_opportunity_id) ?? [];
    list.push(row);
    bySpv.set(row.spv_opportunity_id, list);
  }

  return (
    <div className="space-y-4">
      <SpvComplianceNotice showChecklistNotice showIntakeNotice showPackageNotice />
      <WorkspacePanel
        title="SPV opportunity status"
        subtitle="Admin-managed SPV workflow — founders cannot create legal SPVs in Phase 1"
      >
        {opportunities.length === 0 ? (
          <p className="text-sm text-slate-600">No SPV opportunities have been created for your company yet.</p>
        ) : (
          <div className="space-y-4">
            {opportunities.map((spv) => {
              const rows = bySpv.get(spv.id) ?? [];
              const totals = getSpvParticipationTotals(rows);
              const categories = checklistSummaryBySpv[spv.id] ?? [];
              const packageSummary = packageSummaryBySpv[spv.id];
              const packagePct =
                spv.package_readiness_pct ?? packageSummary?.readinessPct ?? 0;
              const readinessPct = spv.checklist_readiness_pct ?? 0;
              const readiness: SpvOperationalReadinessStatus =
                (spv.operational_readiness_status as SpvOperationalReadinessStatus | null) ??
                (spv.status === "closed" || spv.status === "canceled"
                  ? "closed"
                  : (spv.checklist_readiness_pct ?? 0) >= 100
                    ? "investors_pending"
                    : "checklist_incomplete");
              const timeline = buildFounderSpvTimeline(readiness, {
                spv,
                checklist: [],
                participations: rows,
                requirements: [],
              });

              return (
                <div key={spv.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{spv.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Status: {spv.status} · Target {formatSpvCurrency(spv.target_amount)} · Min{" "}
                    {formatSpvCurrency(spv.minimum_commitment)}
                  </p>
                  <p className="mt-2 text-slate-700">
                    {totals.participantCount} participating investors ·{" "}
                    {formatSpvCurrency(totals.indicativeTotal)} total indicative ·{" "}
                    {totals.softCommittedCount} soft-committed
                  </p>
                  <p className="mt-2 text-xs font-medium text-indigo-700">
                    SPV checklist: {readinessPct}%
                    {spv.document_ready_at ? " · SPV document-ready (operational)" : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Investor documents: {spv.investors_document_ready_count ?? 0} investor(s) document-ready ·{" "}
                    {spv.investor_pending_requirements_count ?? 0} pending requirement(s) (aggregate only)
                  </p>
                  {(packageSummary?.total ?? 0) > 0 ? (
                    <p className="mt-1 text-xs text-violet-800">
                      Legal document packages (operational): {packagePct}% ·{" "}
                      {packageSummary?.complete ?? 0} of {packageSummary?.total ?? 0} packages
                      complete (no internal legal notes shown)
                    </p>
                  ) : null}
                  <ol className="mt-4 space-y-2 border-l-2 border-indigo-100 pl-4">
                    {timeline.map((step) => (
                      <li
                        key={step.key}
                        className={
                          step.current
                            ? "text-sm font-medium text-indigo-800"
                            : step.complete
                              ? "text-xs text-slate-500 line-through"
                              : "text-xs text-slate-600"
                        }
                      >
                        {step.label}
                        {step.current ? " (current)" : null}
                      </li>
                    ))}
                  </ol>
                  {spv.description ? (
                    <p className="mt-2 text-xs text-slate-600">{spv.description}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </WorkspacePanel>
    </div>
  );
}
