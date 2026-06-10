"use client";

import {
  buildSpvReadinessContext,
  computeSpvOperationalReadinessStatus,
  formatOperationalReadinessLabel,
  getSpvNextAction,
  type SpvOperationalReadinessStatus,
} from "@/lib/spv/readiness";
import { computeChecklistReadinessPct, formatSpvCurrency } from "@/lib/spv/display";
import type { ClosingReadinessSummary } from "@/lib/spv/closing-review-display";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { PipelineBoard } from "@/components/ui/ViewToolbar";
import type { ViewDensity } from "@/lib/ui/view-modes";

export type SpvListSummaryRow = {
  id: string;
  name: string;
  companyName: string;
  status: string;
  readiness: SpvOperationalReadinessStatus;
  readinessLabel: string;
  nextAction: string;
  targetAmount: string;
  participantCount: number;
  indicativeTotal: string;
  checklistPct: number;
  closingPct: number;
};

function requirementsForSpv(
  parts: SpvParticipationRecord[],
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>,
) {
  const rows: SpvParticipationRequirementRecord[] = [];
  for (const part of parts) {
    rows.push(...(requirementsByParticipation[part.id] ?? []));
  }
  return rows;
}

export function buildSpvListSummaries(input: {
  opportunities: SpvOpportunityRecord[];
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
  packagesBySpv: Record<string, SpvDocumentPackageRecord[]>;
  closingReadinessBySpv: Record<string, ClosingReadinessSummary>;
  closingReviewsBySpv: Record<string, SpvClosingReviewRecord>;
}): SpvListSummaryRow[] {
  return input.opportunities.map((spv) => {
    const company = Array.isArray(spv.companies) ? spv.companies[0] : spv.companies;
    const parts = input.participationsBySpv[spv.id] ?? [];
    const active = parts.filter((r) => !["declined", "canceled"].includes(r.status));
    const checklist = input.checklistBySpv[spv.id] ?? [];
    const requirements = requirementsForSpv(parts, input.requirementsByParticipation);
    const closingSummary = input.closingReadinessBySpv[spv.id];
    const readinessCtx = buildSpvReadinessContext(spv, checklist, parts, input.requirementsByParticipation);
    const readiness =
      (spv.operational_readiness_status as SpvOperationalReadinessStatus | null) ??
      computeSpvOperationalReadinessStatus(readinessCtx);
    const checklistPct = spv.checklist_readiness_pct ?? computeChecklistReadinessPct(checklist);
    const closingPct = spv.closing_readiness_pct ?? closingSummary?.readinessPct ?? 0;

    return {
      id: spv.id,
      name: spv.name,
      companyName: company?.company_name ?? spv.company_id,
      status: spv.status ?? "draft",
      readiness,
      readinessLabel: formatOperationalReadinessLabel(readiness),
      nextAction: getSpvNextAction(readiness, readinessCtx),
      targetAmount: formatSpvCurrency(spv.target_amount),
      participantCount: active.length,
      indicativeTotal: formatSpvCurrency(active.reduce((sum, r) => sum + (Number(r.indicative_amount) || 0), 0)),
      checklistPct,
      closingPct,
    };
  });
}

export function AdminSpvTableView({
  rows,
  density,
  query,
}: Readonly<{ rows: SpvListSummaryRow[]; density: ViewDensity; query: string }>) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.readinessLabel.toLowerCase().includes(q),
      )
    : rows;

  return (
    <DataTable density={density}>
      <DataTableHead>
        <DataTableHeaderCell>SPV</DataTableHeaderCell>
        <DataTableHeaderCell>Company</DataTableHeaderCell>
        <DataTableHeaderCell>Status</DataTableHeaderCell>
        <DataTableHeaderCell>Readiness</DataTableHeaderCell>
        <DataTableHeaderCell>Next action</DataTableHeaderCell>
        <DataTableHeaderCell>Target</DataTableHeaderCell>
        <DataTableHeaderCell>Participants</DataTableHeaderCell>
        <DataTableHeaderCell>Checklist</DataTableHeaderCell>
      </DataTableHead>
      <DataTableBody>
        {filtered.map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell className="font-medium text-slate-900">{row.name}</DataTableCell>
            <DataTableCell>{row.companyName}</DataTableCell>
            <DataTableCell>{row.status}</DataTableCell>
            <DataTableCell>{row.readinessLabel}</DataTableCell>
            <DataTableCell className="text-xs">{row.nextAction}</DataTableCell>
            <DataTableCell>{row.targetAmount}</DataTableCell>
            <DataTableCell>
              {row.participantCount} · {row.indicativeTotal}
            </DataTableCell>
            <DataTableCell>{row.checklistPct}%</DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}

export function AdminSpvPipelineView({
  rows,
  density,
  query,
}: Readonly<{ rows: SpvListSummaryRow[]; density: ViewDensity; query: string }>) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.readinessLabel.toLowerCase().includes(q),
      )
    : rows;

  const byReadiness = new Map<string, SpvListSummaryRow[]>();
  for (const row of filtered) {
    const list = byReadiness.get(row.readiness) ?? [];
    list.push(row);
    byReadiness.set(row.readiness, list);
  }

  const order: SpvOperationalReadinessStatus[] = [
    "draft",
    "checklist_incomplete",
    "document_ready",
    "investors_pending",
    "ready_for_legal_docs",
    "closed",
  ];

  const columns = order
    .filter((key) => (byReadiness.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      id: key,
      title: formatOperationalReadinessLabel(key),
      items: (byReadiness.get(key) ?? []).map((row) => (
        <div key={row.id} className="rounded-lg border border-slate-200/80 bg-white p-3 text-sm shadow-sm">
          <p className="font-semibold text-slate-950">{row.name}</p>
          <p className="text-xs text-slate-500">{row.companyName}</p>
          <p className="mt-2 text-xs text-slate-600">Target {row.targetAmount}</p>
          <p className="text-xs text-violet-800">Next: {row.nextAction}</p>
        </div>
      )),
    }));

  return <PipelineBoard columns={columns} density={density} />;
}
