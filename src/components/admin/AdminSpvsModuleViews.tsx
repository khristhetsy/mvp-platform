"use client";

import { Suspense } from "react";
import { AdminSpvManagement } from "@/components/AdminSpvManagement";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { useViewMode } from "@/hooks/use-view-mode";
import type { ClosingReadinessSummary } from "@/lib/spv/closing-review-display";
import type {
  SpvChecklistItemRecord,
  SpvClosingReviewRecord,
  SpvDocumentPackageRecord,
  SpvOpportunityRecord,
  SpvParticipationRecord,
  SpvParticipationRequirementRecord,
} from "@/lib/spv/types";

export type AdminSpvsModuleViewsProps = Readonly<{
  opportunities: SpvOpportunityRecord[];
  participationsBySpv: Record<string, SpvParticipationRecord[]>;
  checklistBySpv: Record<string, SpvChecklistItemRecord[]>;
  requirementsByParticipation: Record<string, SpvParticipationRequirementRecord[]>;
  packagesBySpv: Record<string, SpvDocumentPackageRecord[]>;
  closingReviewsBySpv: Record<string, SpvClosingReviewRecord>;
  closingReadinessBySpv: Record<string, ClosingReadinessSummary>;
  companies: Array<{ id: string; name: string }>;
}>;

function AdminSpvsModuleViewsInner(props: AdminSpvsModuleViewsProps) {
  const { viewMode, density, query, setViewMode, setDensity, setQuery, allowedModes } =
    useViewMode("admin-spvs");

  return (
    <>
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search SPVs, companies, or readiness…"
        sticky
      />
      <AdminSpvManagement
        {...props}
        listViewMode={viewMode}
        listDensity={density}
        listQuery={query}
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
