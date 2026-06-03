"use client";

import { Suspense, useMemo } from "react";
import { AdminFounderOutreachSummary } from "@/components/AdminFounderOutreachSummary";
import { AdminInvestorActivity } from "@/components/AdminInvestorActivity";
import { AdminInvestorCrmTimeline } from "@/components/AdminInvestorCrmTimeline";
import { AdminInvestorPipelinePanel } from "@/components/admin/AdminInvestorPipelinePanel";
import { AdminMessageThreadsPanel } from "@/components/AdminMessageThreadsPanel";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";
import type { AdminInvestorPipelineRow } from "@/lib/investor-crm/admin-pipeline";
import type { FounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import type { MessageThreadListItem } from "@/lib/messaging/types";
import {
  filterCrmActivities,
  filterCrmInvestorPanels,
  filterMessageThreads,
  shouldShowCrmInvestorPanels,
  shouldShowCrmMessageThreads,
  type CrmQueryFilters,
} from "@/lib/ui/query-filters";

type Props = Readonly<{
  crmActivity: AdminCrmActivityRow[];
  pipelineRows: AdminInvestorPipelineRow[];
  messageThreads: MessageThreadListItem[];
  outreachSummary: FounderOutreachAdminSummary;
  investorActivity: {
    interests: Array<Record<string, unknown>>;
    introRequests: Array<Record<string, unknown>>;
    savedDeals: Array<Record<string, unknown>>;
  };
}>;

function AdminCrmModuleViewsInner(props: Props) {
  const { filters } = useAdminQueryFilters("crm");
  const crmFilters = filters as CrmQueryFilters;

  const filteredActivity = useMemo(
    () => filterCrmActivities(props.crmActivity, crmFilters),
    [props.crmActivity, crmFilters],
  );

  const filteredThreads = useMemo(
    () => filterMessageThreads(props.messageThreads, crmFilters),
    [props.messageThreads, crmFilters],
  );

  const filteredPanels = useMemo(
    () => filterCrmInvestorPanels(props.investorActivity, crmFilters),
    [props.investorActivity, crmFilters],
  );

  const showThreads = shouldShowCrmMessageThreads(crmFilters);
  const showPanels = shouldShowCrmInvestorPanels(crmFilters);

  return (
    <>
      <AdminQueryFilterBar page="crm" className="mb-4" />

      <AdminInvestorCrmTimeline activities={filteredActivity} />

      <AdminInvestorPipelinePanel
        rows={props.pipelineRows}
        initialCompanyId={crmFilters.company}
        initialInvestorId={crmFilters.investor}
      />

      {filteredActivity.length === 0 && props.crmActivity.length > 0 ? (
        <ModuleEmptyState
          title="No matching CRM activity"
          description="Try clearing filters or adjusting the activity type."
        />
      ) : null}

      <div className="mb-8 mt-8">
        <AdminFounderOutreachSummary summary={props.outreachSummary} />
      </div>

      {showThreads ? (
        <div className="mb-8">
          <AdminMessageThreadsPanel threads={filteredThreads} />
        </div>
      ) : null}

      {showPanels ? (
        <AdminInvestorActivity
          interests={filteredPanels.interests}
          introRequests={filteredPanels.introRequests}
          savedDeals={filteredPanels.savedDeals}
        />
      ) : null}
    </>
  );
}

export function AdminCrmModuleViews(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading filters…</p>}>
      <AdminCrmModuleViewsInner {...props} />
    </Suspense>
  );
}
