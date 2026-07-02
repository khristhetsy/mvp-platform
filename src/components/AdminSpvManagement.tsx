"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SpvComplianceNotice } from "@/components/SpvComplianceNotice";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  areRequiredChecklistItemsComplete,
  computeChecklistReadinessPct,
  formatChecklistCategory,
  formatSpvCurrency,
} from "@/lib/spv/display";
import {
  areRequiredParticipationRequirementsComplete,
  computeParticipationReadinessPct,
  formatParticipationRequirementCategory,
} from "@/lib/spv/participation-display";
import {
  buildSpvReadinessContext,
  computeSpvOperationalReadinessStatus,
  formatOperationalReadinessLabel,
  getSpvNextAction,
  type SpvOperationalReadinessStatus,
} from "@/lib/spv/readiness";
import type { ClosingReadinessSummary } from "@/lib/spv/closing-review-display";
import type { SpvExecutionReadinessSummary } from "@/lib/document-execution/types";
import { SpvExecutionReadinessPanel } from "@/components/spv/SpvExecutionReadinessPanel";
import {
  formatClosingReviewStatusLabel,
} from "@/lib/spv/closing-review-display";
import {
  computePackageReadinessPct,
  formatPackageTypeLabel,
} from "@/lib/spv/document-package-display";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { formatApiError } from "@/lib/api/errors";
import {
  AdminSpvPipelineView,
  AdminSpvTableView,
  buildSpvListSummaries,
} from "@/components/admin/AdminSpvListViews";
import type { ViewDensity, ViewMode } from "@/lib/ui/view-modes";

type CompanyOption = { id: string; name: string };

export function AdminSpvManagement({
  opportunities,
  participationsBySpv,
  checklistBySpv,
  requirementsByParticipation,
  packagesBySpv,
  closingReviewsBySpv,
  closingReadinessBySpv,
  executionReadinessBySpv,
  companies,
  listViewMode = "card",
  listDensity = "comfortable",
  listQuery = "",
}: Readonly<{
  opportunities: SpvOpportunityRecord[];
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
  packagesBySpv: Record<string, SpvDocumentPackageRecord[]>;
  closingReviewsBySpv: Record<string, SpvClosingReviewRecord>;
  closingReadinessBySpv: Record<string, ClosingReadinessSummary>;
  executionReadinessBySpv: Record<string, SpvExecutionReadinessSummary>;
  companies: CompanyOption[];
  listViewMode?: ViewMode;
  listDensity?: ViewDensity;
  listQuery?: string;
}>) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [minimumCommitment, setMinimumCommitment] = useState("");
  const [description, setDescription] = useState("");

  function requirementsForSpv(spvId: string, parts: SpvParticipationRecord[]) {
    const rows: SpvParticipationRequirementRecord[] = [];
    for (const part of parts) {
      rows.push(...(requirementsByParticipation[part.id] ?? []));
    }
    return rows;
  }

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

  const spvListSummaries = useMemo(
    () =>
      buildSpvListSummaries({
        opportunities,
        participationsBySpv,
        checklistBySpv,
        requirementsByParticipation,
        packagesBySpv,
        closingReadinessBySpv,
        closingReviewsBySpv,
      }),
    [
      opportunities,
      participationsBySpv,
      checklistBySpv,
      requirementsByParticipation,
      packagesBySpv,
      closingReadinessBySpv,
      closingReviewsBySpv,
    ],
  );

  async function syncReadiness(spvId: string) {
    setLoading("sync-" + spvId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/spv-opportunities/${spvId}/sync-readiness`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Unable to refresh readiness."));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh readiness.");
    } finally {
      setLoading(null);
    }
  }

  async function openDocument(documentId: string) {
    setLoading("doc-" + documentId);
    setError(null);
    try {
      const response = await fetch("/api/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Unable to open document."));
      }
      const payload = (await response.json()) as { signedUrl?: string };
      if (payload.signedUrl) {
        window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open document.");
    } finally {
      setLoading(null);
    }
  }

  async function updateClosingReview(
    reviewId: string,
    status: string,
    options?: { internalNotes?: string; closingTargetOverride?: boolean },
  ) {
    setLoading("closing-" + reviewId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/spv-closing-reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          internalNotes: options?.internalNotes,
          closingTargetOverride: options?.closingTargetOverride,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Closing review update failed."));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Closing review update failed.");
    } finally {
      setLoading(null);
    }
  }

  async function updatePackage(
    packageId: string,
    status: string,
    notes?: string,
  ) {
    setLoading("pkg-" + packageId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/spv-document-packages/${packageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Package update failed."));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Package update failed.");
    } finally {
      setLoading(null);
    }
  }

  async function updateRequirement(requirementId: string, status: string) {
    setLoading("req-" + requirementId);
    setError(null);
    let reviewNotes: string | undefined;
    if (status === "rejected") {
      const reason = window.prompt("Rejection reason (shown to investor, optional):");
      if (reason === null) {
        setLoading(null);
        return;
      }
      reviewNotes = reason.trim() || undefined;
    }
    try {
      const response = await fetch(`/api/admin/spv-participation-requirements/${requirementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Requirement update failed."));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Requirement update failed.");
    } finally {
      setLoading(null);
    }
  }

  async function setParticipationStatus(participationId: string, status: string) {
    setLoading("part-" + participationId + status);
    setError(null);
    try {
      const response = await fetch(`/api/admin/spv-participations/${participationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(formatApiError(payload, "Participation update failed."));
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Participation update failed.");
    } finally {
      setLoading(null);
    }
  }

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
      <SpvComplianceNotice
        showChecklistNotice
        showIntakeNotice
        showUploadNotice
        showPackageNotice
        showClosingNotice
      />

      <WorkspacePanel title={t("create_spv_opportunity")} subtitle={t("admin_reviewed_workflow_not_legal_formation")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">{t("company")}</span>
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
            <span className="text-slate-600">{t("spv_name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder={t("e_g_series_seed_spv")}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("target_amount_usd")}</span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("minimum_commitment_usd")}</span>
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
          placeholder={t("internal_description_terms_summary_for_inves")}
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

      <WorkspacePanel title={t("spv_opportunities")} subtitle={`${opportunities.length} total`}>
        {opportunities.length === 0 ? (
          <p className="text-sm text-slate-500">{t("no_spv_opportunities_yet")}</p>
        ) : listViewMode === "table" ? (
          <AdminSpvTableView rows={spvListSummaries} density={listDensity} query={listQuery} />
        ) : listViewMode === "pipeline" ? (
          <AdminSpvPipelineView rows={spvListSummaries} density={listDensity} query={listQuery} />
        ) : (
          <div className="space-y-4">
            {opportunities.map((spv) => {
              const company = Array.isArray(spv.companies) ? spv.companies[0] : spv.companies;
              const parts = participationsBySpv[spv.id] ?? [];
              const totals = totalsBySpv[spv.id] ?? { count: 0, total: 0 };
              const checklist = checklistBySpv[spv.id] ?? [];
              const packages = packagesBySpv[spv.id] ?? [];
              const closingReview = closingReviewsBySpv[spv.id];
              const closingSummary = closingReadinessBySpv[spv.id];
              const executionSummary = executionReadinessBySpv[spv.id];
              const closingPct =
                spv.closing_readiness_pct ?? closingSummary?.readinessPct ?? 0;
              const packagePct =
                spv.package_readiness_pct ?? computePackageReadinessPct(packages);
              const readinessPct =
                spv.checklist_readiness_pct ?? computeChecklistReadinessPct(checklist);
              const canClose = areRequiredChecklistItemsComplete(checklist);
              const readinessCtx = buildSpvReadinessContext(
                spv,
                checklist,
                parts,
                requirementsByParticipation,
              );
              const readiness: SpvOperationalReadinessStatus =
                (spv.operational_readiness_status as SpvOperationalReadinessStatus | null) ??
                computeSpvOperationalReadinessStatus(readinessCtx);
              const nextAction = getSpvNextAction(readiness, readinessCtx);

              return (
                <div key={spv.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{spv.name}</p>
                      <p className="text-xs text-slate-500">
                        {company?.company_name ?? spv.company_id} · {spv.status} · target{" "}
                        {formatSpvCurrency(spv.target_amount)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-violet-800">
                        Readiness: {formatOperationalReadinessLabel(readiness)} · Next: {nextAction}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p>
                        {totals.count} participants · {formatSpvCurrency(totals.total)} indicative
                      </p>
                      <p className="mt-1 font-medium text-indigo-700">
                        SPV checklist: {readinessPct}%
                        {packages.length > 0 ? ` · Document packages: ${packagePct}%` : null}
                        {closingSummary ? ` · Closing readiness: ${closingPct}%` : null}
                        {executionSummary
                          ? ` · Execution readiness: ${executionSummary.executionReadinessPct}%`
                          : null}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {spv.investors_document_ready_count ?? 0} investors document-ready ·{" "}
                        {spv.investor_pending_requirements_count ?? 0} pending investor reqs
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading != null}
                      onClick={() => void syncReadiness(spv.id)}
                      className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800"
                    >
                      {loading === "sync-" + spv.id ? "Refreshing…" : "Refresh readiness"}
                    </button>
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

                  {packages.length > 0 ? (
                    <div className="mt-4 rounded-lg bg-violet-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                        Document package tracker · {packagePct}% ready
                      </p>
                      <ul className="mt-2 space-y-2">
                        {packages.map((pkg) => (
                          <li
                            key={pkg.id}
                            className="rounded border border-violet-200 bg-white px-2 py-2 text-xs"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-slate-900">
                                  {formatPackageTypeLabel(pkg.package_type)}
                                </p>
                                <p className="text-slate-500">Status: {pkg.status}</p>
                                <label className="mt-2 block text-slate-600">
                                  Internal notes (admin only)
                                  <textarea
                                    id={`pkg-notes-${pkg.id}`}
                                    defaultValue={pkg.notes ?? ""}
                                    rows={2}
                                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                    placeholder={t("counsel_review_notes_package_blockers")}
                                  />
                                </label>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => {
                                    const notes =
                                      (
                                        document.getElementById(
                                          `pkg-notes-${pkg.id}`,
                                        ) as HTMLTextAreaElement | null
                                      )?.value ?? "";
                                    void updatePackage(pkg.id, "preparing", notes);
                                  }}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Preparing
                                </button>
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => {
                                    const notes =
                                      (
                                        document.getElementById(
                                          `pkg-notes-${pkg.id}`,
                                        ) as HTMLTextAreaElement | null
                                      )?.value ?? "";
                                    void updatePackage(pkg.id, "under_review", notes);
                                  }}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Under review
                                </button>
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => {
                                    const notes =
                                      (
                                        document.getElementById(
                                          `pkg-notes-${pkg.id}`,
                                        ) as HTMLTextAreaElement | null
                                      )?.value ?? "";
                                    void updatePackage(pkg.id, "approved", notes);
                                  }}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => {
                                    const notes =
                                      (
                                        document.getElementById(
                                          `pkg-notes-${pkg.id}`,
                                        ) as HTMLTextAreaElement | null
                                      )?.value ?? "";
                                    void updatePackage(pkg.id, "issued", notes);
                                  }}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Issue
                                </button>
                                <button
                                  type="button"
                                  disabled={loading != null}
                                  onClick={() => {
                                    const notes =
                                      (
                                        document.getElementById(
                                          `pkg-notes-${pkg.id}`,
                                        ) as HTMLTextAreaElement | null
                                      )?.value ?? "";
                                    void updatePackage(pkg.id, "archived", notes);
                                  }}
                                  className="rounded border px-1.5 py-0.5"
                                >
                                  Archive
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : readiness === "ready_for_legal_docs" ? (
                    <p className="mt-3 text-xs text-amber-800">
                      Packages will auto-seed when operational readiness reaches ready for legal
                      docs (refresh if just updated).
                    </p>
                  ) : null}

                  {executionSummary ? <SpvExecutionReadinessPanel summary={executionSummary} /> : null}

                  {closingSummary ? (
                    <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
                        Final operational closing review · {closingPct}%
                        {closingReview
                          ? ` · ${formatClosingReviewStatusLabel(closingReview.status)}`
                          : null}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {closingSummary.criteria.map((item) => (
                          <li
                            key={item.key}
                            className={item.met ? "text-emerald-800" : "text-amber-900"}
                          >
                            {item.met ? "✓" : "○"} {item.label}
                          </li>
                        ))}
                      </ul>
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(spv.closing_target_override)}
                          disabled={loading != null || !closingReview}
                          onChange={(e) => {
                            if (!closingReview) {
                              return;
                            }
                            void updateClosingReview(closingReview.id, closingReview.status, {
                              closingTargetOverride: e.target.checked,
                            });
                          }}
                        />
                        Admin override: indicative target not required for closing
                      </label>
                      {closingReview ? (
                        <>
                          <label className="mt-2 block text-xs text-slate-600">
                            Internal closing notes (admin only)
                            <textarea
                              id={`closing-notes-${closingReview.id}`}
                              defaultValue={closingReview.internal_notes ?? ""}
                              rows={2}
                              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={
                                loading != null ||
                                !closingSummary.eligibleForFinalReview ||
                                closingReview.status !== "not_started"
                              }
                              title={
                                closingSummary.eligibleForFinalReview
                                  ? undefined
                                  : "Complete all closing readiness criteria first."
                              }
                              onClick={() => {
                                const notes =
                                  (
                                    document.getElementById(
                                      `closing-notes-${closingReview.id}`,
                                    ) as HTMLTextAreaElement | null
                                  )?.value ?? "";
                                void updateClosingReview(closingReview.id, "in_review", {
                                  internalNotes: notes,
                                });
                              }}
                              className="rounded border px-1.5 py-0.5 disabled:opacity-40"
                            >
                              Start final review
                            </button>
                            <button
                              type="button"
                              disabled={loading != null || closingReview.status !== "in_review"}
                              onClick={() => {
                                const notes =
                                  (
                                    document.getElementById(
                                      `closing-notes-${closingReview.id}`,
                                    ) as HTMLTextAreaElement | null
                                  )?.value ?? "";
                                void updateClosingReview(closingReview.id, "approved_for_closing", {
                                  internalNotes: notes,
                                });
                              }}
                              className="rounded border px-1.5 py-0.5 disabled:opacity-40"
                            >
                              Approve for closing
                            </button>
                            <button
                              type="button"
                              disabled={loading != null || closingReview.status !== "in_review"}
                              onClick={() => {
                                const notes =
                                  (
                                    document.getElementById(
                                      `closing-notes-${closingReview.id}`,
                                    ) as HTMLTextAreaElement | null
                                  )?.value ?? "";
                                void updateClosingReview(closingReview.id, "changes_required", {
                                  internalNotes: notes,
                                });
                              }}
                              className="rounded border px-1.5 py-0.5 disabled:opacity-40"
                            >
                              Request changes
                            </button>
                            <button
                              type="button"
                              disabled={
                                loading != null ||
                                closingReview.status !== "approved_for_closing"
                              }
                              onClick={() => {
                                const notes =
                                  (
                                    document.getElementById(
                                      `closing-notes-${closingReview.id}`,
                                    ) as HTMLTextAreaElement | null
                                  )?.value ?? "";
                                void updateClosingReview(closingReview.id, "closed_operationally", {
                                  internalNotes: notes,
                                });
                              }}
                              className="rounded border px-1.5 py-0.5 disabled:opacity-40"
                            >
                              Mark operationally closed
                            </button>
                            {closingReview.status === "changes_required" ? (
                              <button
                                type="button"
                                disabled={loading != null}
                                onClick={() => {
                                  const notes =
                                    (
                                      document.getElementById(
                                        `closing-notes-${closingReview.id}`,
                                      ) as HTMLTextAreaElement | null
                                    )?.value ?? "";
                                  void updateClosingReview(closingReview.id, "in_review", {
                                    internalNotes: notes,
                                  });
                                }}
                                className="rounded border px-1.5 py-0.5"
                              >
                                Resume review
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-amber-800">
                          Closing review initializes when readiness sync runs (update checklist,
                          packages, or refresh page after migration).
                        </p>
                      )}
                    </div>
                  ) : null}

                  {parts.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Investor document intake
                      </p>
                      {parts.map((row) => {
                        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                        const requirements = requirementsByParticipation[row.id] ?? [];
                        const investorPct =
                          row.document_readiness_pct ?? computeParticipationReadinessPct(requirements);
                        const canComplete = areRequiredParticipationRequirementsComplete(requirements);

                        return (
                          <div
                            key={row.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-xs"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium text-slate-900">
                                {profile?.full_name ?? profile?.email ?? "Investor"} · {row.status} ·{" "}
                                {formatSpvCurrency(row.indicative_amount)}
                              </p>
                              <p className="text-indigo-700">Investor readiness: {investorPct}%</p>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={loading != null || !canComplete}
                                title={
                                  canComplete
                                    ? undefined
                                    : "Approve or waive all required investor requirements first."
                                }
                                onClick={() => void setParticipationStatus(row.id, "completed")}
                                className="rounded border px-1.5 py-0.5 disabled:opacity-40"
                              >
                                Mark completed
                              </button>
                            </div>
                            {requirements.length > 0 ? (
                              <ul className="mt-2 space-y-2">
                                {requirements.map((req) => {
                                  const doc = Array.isArray(req.documents)
                                    ? req.documents[0]
                                    : req.documents;

                                  return (
                                    <li key={req.id} className="rounded border border-slate-100 px-2 py-1.5">
                                      <p className="font-medium text-slate-800">
                                        {req.title}
                                        {req.required ? (
                                          <span className="ml-1 text-red-600">*</span>
                                        ) : null}
                                      </p>
                                      <p className="text-slate-500">
                                        {formatParticipationRequirementCategory(req.category)} · {req.status}
                                      </p>
                                      {req.review_notes ? (
                                        <p className="mt-1 text-red-800">Notes: {req.review_notes}</p>
                                      ) : null}
                                      {doc ? (
                                        <p className="mt-1 text-slate-600">
                                          File: {doc.file_name ?? "document"}
                                          {doc.size_bytes
                                            ? ` · ${Math.round(doc.size_bytes / 1024)} KB`
                                            : ""}
                                        </p>
                                      ) : null}
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {doc?.id ? (
                                          <button
                                            type="button"
                                            disabled={loading != null}
                                            onClick={() => void openDocument(doc.id)}
                                            className="rounded border px-1.5 py-0.5"
                                          >
                                            Open document
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          disabled={loading != null}
                                          onClick={() => void updateRequirement(req.id, "under_review")}
                                          className="rounded border px-1.5 py-0.5"
                                        >
                                          Under review
                                        </button>
                                        <button
                                          type="button"
                                          disabled={loading != null}
                                          onClick={() => void updateRequirement(req.id, "approved")}
                                          className="rounded border px-1.5 py-0.5"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          disabled={loading != null}
                                          onClick={() => void updateRequirement(req.id, "rejected")}
                                          className="rounded border px-1.5 py-0.5"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          type="button"
                                          disabled={loading != null}
                                          onClick={() => void updateRequirement(req.id, "waived")}
                                          className="rounded border px-1.5 py-0.5"
                                        >
                                          Waive
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="mt-2 text-amber-800">
                                Requirements not seeded (re-seed participation or create new).
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
