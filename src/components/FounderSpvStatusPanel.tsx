import { WorkspacePanel } from "@/components/WorkspacePanel";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import { formatSpvCurrency, getSpvParticipationTotals } from "@/lib/spv/display";
import type { SpvOpportunityRecord, SpvParticipationRecord } from "@/lib/spv/types";

export function FounderSpvStatusPanel({
  opportunities,
  participations,
}: Readonly<{
  opportunities: SpvOpportunityRecord[];
  participations: SpvParticipationRecord[];
}>) {
  const bySpv = new Map<string, SpvParticipationRecord[]>();
  for (const row of participations) {
    const list = bySpv.get(row.spv_opportunity_id) ?? [];
    list.push(row);
    bySpv.set(row.spv_opportunity_id, list);
  }

  return (
    <div className="space-y-4">
      <SpvComplianceNotice />
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
