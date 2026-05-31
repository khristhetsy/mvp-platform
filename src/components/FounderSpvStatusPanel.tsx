import { WorkspacePanel } from "@/components/WorkspacePanel";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import {
  formatChecklistCategory,
  formatSpvCurrency,
  getSpvParticipationTotals,
} from "@/lib/spv/display";
import type { SpvChecklistCategory, SpvOpportunityRecord, SpvParticipationRecord } from "@/lib/spv/types";

type CategorySummary = {
  category: SpvChecklistCategory;
  total: number;
  completed: number;
};

export function FounderSpvStatusPanel({
  opportunities,
  participations,
  checklistSummaryBySpv,
}: Readonly<{
  opportunities: SpvOpportunityRecord[];
  participations: SpvParticipationRecord[];
  checklistSummaryBySpv: Record<string, CategorySummary[]>;
}>) {
  const bySpv = new Map<string, SpvParticipationRecord[]>();
  for (const row of participations) {
    const list = bySpv.get(row.spv_opportunity_id) ?? [];
    list.push(row);
    bySpv.set(row.spv_opportunity_id, list);
  }

  return (
    <div className="space-y-4">
      <SpvComplianceNotice showChecklistNotice showIntakeNotice />
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
              const readinessPct = spv.checklist_readiness_pct ?? 0;

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
                  {categories.length > 0 ? (
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {categories.map((row) => (
                        <li key={row.category} className="text-xs text-slate-600">
                          {formatChecklistCategory(row.category)}: {row.completed}/{row.total} complete
                        </li>
                      ))}
                    </ul>
                  ) : null}
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
