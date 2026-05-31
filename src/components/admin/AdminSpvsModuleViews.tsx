"use client";

import { Suspense, useMemo } from "react";
import { AdminSpvManagement } from "@/components/AdminSpvManagement";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
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
import { filterSpvOpportunities, type SpvQueryFilters } from "@/lib/ui/query-filters";

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

  return (
    <>
      <AdminQueryFilterBar page="spvs" className="mb-4" />
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
        opportunities={filteredOpportunities}
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
