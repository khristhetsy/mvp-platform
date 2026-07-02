"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatSpvCurrency, investorPreparationLabel } from "@/lib/spv/display";
import { InvestorSpvNextActionBanner } from "@/components/InvestorSpvNextActionBanner";
import { InvestorSpvRequirementRow } from "@/components/InvestorSpvRequirementRow";
import { computeParticipationReadinessPct } from "@/lib/spv/participation-display";
import { getInvestorSpvNextAction } from "@/lib/spv/readiness";
import type {
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { formatApiError } from "@/lib/api/errors";

type ParticipationRow = SpvParticipationRecord & {
  spv_opportunities?: SpvOpportunityRecord | SpvOpportunityRecord[] | null;
};

export function InvestorSpvWorkspace({
  openOpportunities,
  participations,
  requirements,
}: Readonly<{
  openOpportunities: SpvOpportunityRecord[];
  participations: ParticipationRow[];
  requirements: SpvParticipationRequirementRecord[];
}>) {
  const t = useTranslations("sharedCmp");
  const requirementsByParticipation = new Map<string, SpvParticipationRequirementRecord[]>();
  for (const row of requirements) {
    const list = requirementsByParticipation.get(row.spv_participation_id) ?? [];
    list.push(row);
    requirementsByParticipation.set(row.spv_participation_id, list);
  }
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
      <SpvComplianceNotice
        showChecklistNotice
        showIntakeNotice
        showUploadNotice
        showPackageNotice
        showClosingNotice
      />

      <InvestorSpvNextActionBanner action={getInvestorSpvNextAction(requirements)} />

      <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-900">
        E-sign (DocuSign) is not connected. Complete your assigned requirements below so your SPV participation can
        reach execution readiness when admin enables future signing.
      </p>

      <WorkspacePanel
        title={t("your_document_requirements")}
        subtitle={t("upload_supporting_documents_for_your_spv_par")}
      >
        {requirements.length === 0 ? (
          <p className="text-sm text-slate-600">{t("no_document_requirements_assigned_yet")}</p>
        ) : (
          <div className="space-y-4">
            {participations.map((row) => {
              const spv = Array.isArray(row.spv_opportunities)
                ? row.spv_opportunities[0]
                : row.spv_opportunities;
              const rows = requirementsByParticipation.get(row.id) ?? [];
              if (rows.length === 0) {
                return null;
              }
              const pct = row.document_readiness_pct ?? computeParticipationReadinessPct(rows);

              return (
                <div key={row.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{spv?.name ?? "SPV"}</p>
                  <p className="mt-1 text-xs text-indigo-700">Your document readiness: {pct}%</p>
                  <ul className="mt-3 space-y-2">
                    {rows.map((req) => (
                      <InvestorSpvRequirementRow key={req.id} requirement={req} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </WorkspacePanel>

      <WorkspacePanel title={t("your_spv_participations")} subtitle={`${participations.length} record(s)`}>
        {participations.length === 0 ? (
          <p className="text-sm text-slate-600">{t("you_have_not_joined_an_spv_opportunity_yet")}</p>
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
                    {spv?.investor_closing_status
                      ? `SPV closing: ${spv.investor_closing_status}`
                      : spv?.investor_package_status
                        ? `SPV documents: ${spv.investor_package_status}`
                        : `SPV preparation: ${investorPreparationLabel(
                            spv?.checklist_readiness_pct,
                            spv?.document_ready_at,
                          )}`}
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

      <WorkspacePanel title={t("open_spv_opportunities")} subtitle={t("express_non_binding_indicative_interest")}>
        {openOpportunities.length === 0 ? (
          <p className="text-sm text-slate-600">{t("no_open_spv_opportunities_right_now")}</p>
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
                    {spv.investor_closing_status
                      ? `SPV closing: ${spv.investor_closing_status}`
                      : spv.investor_package_status
                        ? `SPV documents: ${spv.investor_package_status}`
                        : `SPV preparation: ${investorPreparationLabel(
                            spv.checklist_readiness_pct,
                            spv.document_ready_at,
                          )}`}
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
