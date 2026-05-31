"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  areRequiredChecklistItemsComplete,
  computeChecklistReadinessPct,
  formatChecklistCategory,
  formatSpvCurrency,
} from "@/lib/spv/display";
import type {
  SpvChecklistItemRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
} from "@/lib/spv/types";
import { formatApiError } from "@/lib/api/errors";

type CompanyOption = { id: string; name: string };

export function AdminSpvManagement({
  opportunities,
  participationsBySpv,
  checklistBySpv,
  companies,
}: Readonly<{
  opportunities: SpvOpportunityRecord[];
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  companies: CompanyOption[];
}>) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [minimumCommitment, setMinimumCommitment] = useState("");
  const [description, setDescription] = useState("");

  const totalsBySpv = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const [spvId, rows] of Object.entries(participationsBySpv)) {
      const active = rows.filter((r) => !["declined", "canceled"].includes(r.status));
      map[spvId] = {
        count: active.length,
        total: active.reduce((sum, r) => sum + (Number(r.indicative_amount) || 0), 0),
      };
    }
    return map;
  }, [participationsBySpv]);

  async function updateChecklistItem(itemId: string, status: string) {
    setLoading("checklist-" + itemId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/spv-checklist-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Checklist update failed."));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checklist update failed.");
    } finally {
      setLoading(null);
    }
  }

  async function callApi(
    path: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(formatApiError(payload, "Request failed."));
    }
    return response.json();
  }

  async function createOpportunity() {
    setLoading("create");
    setError(null);
    try {
      await callApi(
        "/api/admin/spv-opportunities",
        "POST",
        {
          companyId,
          name,
          targetAmount: targetAmount ? Number(targetAmount) : undefined,
          minimumCommitment: minimumCommitment ? Number(minimumCommitment) : undefined,
          description,
          status: "under_review",
        },
      );
      setName("");
      setDescription("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Create failed.");
    } finally {
      setLoading(null);
    }
  }

  async function setStatus(spvId: string, status: string) {
    setLoading(spvId + status);
    setError(null);
    try {
      await callApi(`/api/admin/spv-opportunities/${spvId}`, "PATCH", { status });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setLoading(null);
    }
  }

  async function seedParticipations(spvId: string) {
    setLoading("seed-" + spvId);
    setError(null);
    try {
      await callApi(`/api/admin/spv-opportunities/${spvId}/seed-participations`, "POST", {});
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Seed failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <SpvComplianceNotice showChecklistNotice />

      <WorkspacePanel title="Create SPV opportunity" subtitle="Admin-reviewed workflow — not legal formation">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Company</span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">SPV name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g. Series Seed SPV"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Target amount (USD)</span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Minimum commitment (USD)</span>
            <input
              type="number"
              value={minimumCommitment}
              onChange={(e) => setMinimumCommitment(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Internal description / terms summary for investors"
          className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
        />
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={loading != null || !name.trim() || !companyId}
          onClick={() => void createOpportunity()}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Create SPV opportunity
        </button>
      </WorkspacePanel>

      <WorkspacePanel title="SPV opportunities" subtitle={`${opportunities.length} total`}>
        {opportunities.length === 0 ? (
          <p className="text-sm text-slate-500">No SPV opportunities yet.</p>
        ) : (
          <div className="space-y-4">
            {opportunities.map((spv) => {
              const company = Array.isArray(spv.companies) ? spv.companies[0] : spv.companies;
              const parts = participationsBySpv[spv.id] ?? [];
              const totals = totalsBySpv[spv.id] ?? { count: 0, total: 0 };
              const checklist = checklistBySpv[spv.id] ?? [];
              const readinessPct =
                spv.checklist_readiness_pct ?? computeChecklistReadinessPct(checklist);
              const canClose = areRequiredChecklistItemsComplete(checklist);

              return (
                <div key={spv.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{spv.name}</p>
                      <p className="text-xs text-slate-500">
                        {company?.company_name ?? spv.company_id} · {spv.status} · target{" "}
                        {formatSpvCurrency(spv.target_amount)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p>
                        {totals.count} participants · {formatSpvCurrency(totals.total)} indicative
                      </p>
                      <p className="mt-1 font-medium text-indigo-700">
                        Document readiness: {readinessPct}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading != null}
                      onClick={() => void setStatus(spv.id, "open")}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={loading != null || !canClose}
                      title={
                        canClose
                          ? undefined
                          : "Complete or waive all required checklist items before closing."
                      }
                      onClick={() => void setStatus(spv.id, "closed")}
                      className="rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={loading != null}
                      onClick={() => void seedParticipations(spv.id)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Seed from interests
                    </button>
                  </div>
                  {checklist.length > 0 ? (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Document readiness checklist
                      </p>
                      <ul className="mt-2 space-y-2">
                        {checklist.map((item) => (
                          <li
                            key={item.id}
                            className="rounded border border-slate-200 bg-white px-2 py-2 text-xs"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-slate-900">
                                  {item.title}
                                  {item.required ? (
                                    <span className="ml-1 text-red-600">*</span>
                                  ) : null}
                                </p>
                                <p className="text-slate-500">
                                  {formatChecklistCategory(item.category)} · {item.status}
                                </p>
                                {item.description ? (
                                  <p className="mt-1 text-slate-600">{item.description}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => void updateChecklistItem(item.id, "in_progress")}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  In progress
                                </button>
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => void updateChecklistItem(item.id, "completed")}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Complete
                                </button>
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => void updateChecklistItem(item.id, "waived")}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Waive
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-amber-800">
                      Checklist not initialized for this SPV (create new SPVs to auto-seed).
                    </p>
                  )}

                  {parts.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-xs text-slate-600">
                      {parts.slice(0, 8).map((row) => {
                        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                        return (
                          <li key={row.id}>
                            {profile?.full_name ?? profile?.email ?? "Investor"} · {row.status} ·{" "}
                            {formatSpvCurrency(row.indicative_amount)}
                          </li>
                        );
                      })}
                    </ul>
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
