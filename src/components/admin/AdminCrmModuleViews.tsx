"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type CrmView = "activity" | "pipeline" | "messages" | "outreach";

const CRM_TABS: { id: CrmView; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "pipeline", label: "Pipeline" },
  { id: "messages", label: "Messages" },
  { id: "outreach", label: "Outreach" },
];

function CrmViewTabs({
  activeView,
  onSelect,
}: Readonly<{
  activeView: CrmView;
  onSelect: (view: CrmView) => void;
}>) {
  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1">
      {CRM_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeView === tab.id
              ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function AdminCrmModuleViewsInner(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters } = useAdminQueryFilters("crm");
  const crmFilters = filters as CrmQueryFilters;

  const rawView = searchParams.get("view");
  const activeView: CrmView =
    rawView === "pipeline" || rawView === "messages" || rawView === "outreach"
      ? rawView
      : "activity";

  function handleSelectView(view: CrmView) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "activity") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

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

  const showPanels = shouldShowCrmInvestorPanels(crmFilters);

  return (
    <>
      <CrmViewTabs activeView={activeView} onSelect={handleSelectView} />

      {activeView === "activity" ? (
        <>
          <AdminQueryFilterBar page="crm" className="mb-4" />
          <AdminInvestorCrmTimeline activities={filteredActivity} />
          {filteredActivity.length === 0 && props.crmActivity.length > 0 ? (
            <ModuleEmptyState
              title="No matching CRM activity"
              description="Try clearing filters or adjusting the activity type."
            />
          ) : null}
        </>
      ) : null}

      {activeView === "pipeline" ? (
        <AdminInvestorPipelinePanel
          rows={props.pipelineRows}
          initialCompanyId={crmFilters.company}
          initialInvestorId={crmFilters.investor}
        />
      ) : null}

      {activeView === "messages" ? (
        <AdminMessageThreadsPanel threads={filteredThreads} />
      ) : null}

      {activeView === "outreach" ? (
        <>
          <div className="mb-8">
            <AdminFounderOutreachSummary summary={props.outreachSummary} />
          </div>
          {showPanels ? (
            <AdminInvestorActivity
              interests={filteredPanels.interests}
              introRequests={filteredPanels.introRequests}
              savedDeals={filteredPanels.savedDeals}
            />
          ) : null}
        </>
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
