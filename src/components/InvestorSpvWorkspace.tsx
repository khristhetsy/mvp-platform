"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatSpvCurrency, investorPreparationLabel } from "@/lib/spv/display";
import type { SpvOpportunityRecord, SpvParticipationRecord } from "@/lib/spv/types";
import { formatApiError } from "@/lib/api/errors";

type ParticipationRow = SpvParticipationRecord & {
  spv_opportunities?: SpvOpportunityRecord | SpvOpportunityRecord[] | null;
};

export function InvestorSpvWorkspace({
  openOpportunities,
  participations,
}: Readonly<{
  openOpportunities: SpvOpportunityRecord[];
  participations: ParticipationRow[];
}>) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  async function expressInterest(spvId: string, indicativeAmount?: number) {
    setLoading(spvId);
    setError(null);
    const response = await fetch("/api/investor/spv-participations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spvOpportunityId: spvId,
        indicativeAmount: indicativeAmount,
        status: indicativeAmount && indicativeAmount > 0 ? "soft_committed" : "interested",
      }),
    });
    setLoading(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(formatApiError(payload, "Unable to save SPV interest."));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <SpvComplianceNotice showChecklistNotice />

      <WorkspacePanel title="Your SPV participations" subtitle={`${participations.length} record(s)`}>
        {participations.length === 0 ? (
          <p className="text-sm text-slate-600">You have not joined an SPV opportunity yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {participations.map((row) => {
              const spv = Array.isArray(row.spv_opportunities)
                ? row.spv_opportunities[0]
                : row.spv_opportunities;
              const company = Array.isArray(spv?.companies) ? spv?.companies[0] : spv?.companies;

              return (
                <div key={row.id} className="py-4 text-sm">
                  <p className="font-medium text-slate-900">{spv?.name ?? "SPV opportunity"}</p>
                  <p className="text-xs text-slate-500">
                    {company?.company_name ?? "Company"} · {row.status} ·{" "}
                    {formatSpvCurrency(row.indicative_amount)}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    SPV preparation:{" "}
                    {investorPreparationLabel(
                      spv?.checklist_readiness_pct,
                      spv?.document_ready_at,
                    )}
                  </p>
                  {row.company_id ? (
                    <Link
                      href={`/investor/opportunities/${row.company_id}/report`}
                      className="mt-2 inline-block text-xs font-semibold text-indigo-700"
                    >
                      View company report
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </WorkspacePanel>

      <WorkspacePanel title="Open SPV opportunities" subtitle="Express non-binding indicative interest">
        {openOpportunities.length === 0 ? (
          <p className="text-sm text-slate-600">No open SPV opportunities right now.</p>
        ) : (
          <div className="space-y-4">
            {openOpportunities.map((spv) => {
              const company = Array.isArray(spv.companies) ? spv.companies[0] : spv.companies;
              return (
                <div key={spv.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{spv.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {company?.company_name} · Target {formatSpvCurrency(spv.target_amount)} · Min{" "}
                    {formatSpvCurrency(spv.minimum_commitment)}
                  </p>
                  {spv.description ? <p className="mt-2 text-slate-600">{spv.description}</p> : null}
                  <p className="mt-2 text-xs text-indigo-700">
                    SPV preparation:{" "}
                    {investorPreparationLabel(spv.checklist_readiness_pct, spv.document_ready_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-xs">
                      Indicative amount (USD)
                      <input
                        type="number"
                        value={amounts[spv.id] ?? ""}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [spv.id]: e.target.value }))}
                        className="mt-1 block w-32 rounded border px-2 py-1"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={loading === spv.id}
                      onClick={() =>
                        void expressInterest(
                          spv.id,
                          amounts[spv.id] ? Number(amounts[spv.id]) : undefined,
                        )
                      }
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Express SPV interest
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </WorkspacePanel>
    </div>
  );
}
