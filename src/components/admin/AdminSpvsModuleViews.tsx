"use client";

import { Suspense, useMemo, useState } from "react";
import { AdminSpvManagement } from "@/components/AdminSpvManagement";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { ClosingReadinessSummary } from "@/lib/spv/closing-review-display";
import type { SpvExecutionReadinessSummary } from "@/lib/document-execution/types";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";
import { filterSpvOpportunities, type SpvQueryFilters } from "@/lib/ui/query-filters";

type ViewMode = "kanban" | "grid" | "list";

export type AdminSpvsModuleViewsProps = Readonly<{
  opportunities: SpvOpportunityRecord[];
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
  packagesBySpv: Record<string, SpvDocumentPackageRecord[]>;
  closingReviewsBySpv: Record<string, SpvClosingReviewRecord>;
  closingReadinessBySpv: Record<string, ClosingReadinessSummary>;
  executionReadinessBySpv: Record<string, SpvExecutionReadinessSummary>;
  companies: Array<{ id: string; name: string }>;
}>;

function AdminSpvsModuleViewsInner(props: AdminSpvsModuleViewsProps) {
  const [view, setView] = useState<ViewMode>("kanban");
  const { filters } = useAdminQueryFilters("spvs");
  const spvFilters = filters as SpvQueryFilters;

  const companiesById = useMemo(
    () => new Map(props.companies.map((company) => [company.id, company.name])),
    [props.companies],
  );

  const filteredOpportunities = useMemo(
    () =>
      filterSpvOpportunities(props.opportunities, { ...spvFilters, q: "" }, {
        requirementsByParticipation: props.requirementsByParticipation,
        participationsBySpv: props.participationsBySpv,
        companiesById,
      }),
    [props.opportunities, props.requirementsByParticipation, props.participationsBySpv, spvFilters, companiesById],
  );

  const listViewMode = view === "kanban" ? "pipeline" : view === "grid" ? "card" : "table";

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <AdminQueryFilterBar page="spvs" />
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
      <AdminSpvManagement
        {...props}
        opportunities={filteredOpportunities}
        listViewMode={listViewMode}
        listDensity="comfortable"
        listQuery=""
      />
    </>
  );
}

export function AdminSpvsModuleViews(props: AdminSpvsModuleViewsProps) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading view options…</p>}>
      <AdminSpvsModuleViewsInner {...props} />
    </Suspense>
  );
}
