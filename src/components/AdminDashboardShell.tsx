"use client";

import { useEffect, useState } from "react";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCommandHeader } from "@/components/admin/dashboard/AdminCommandHeader";
import { AdminInvestorActivityPanels } from "@/components/admin/dashboard/AdminInvestorActivityPanels";
import { AdminKpiGrid } from "@/components/admin/dashboard/AdminKpiGrid";
import { AdminOrchestrationVisibility } from "@/components/admin/dashboard/AdminOrchestrationVisibility";
import { AdminOperationsControl } from "@/components/admin/dashboard/AdminOperationsControl";
import { AdminPlatformActivityGraph } from "@/components/admin/dashboard/AdminPlatformActivityGraph";
import { AdminPlatformOverview } from "@/components/admin/dashboard/AdminPlatformOverview";
import { AdminRecentActivityTimeline } from "@/components/admin/dashboard/AdminRecentActivityTimeline";
import { AdminSystemHealthSection } from "@/components/admin/dashboard/AdminSystemHealthSection";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import type { AdminCommandCenterProps } from "@/components/admin/dashboard/types";
import { canSeeCard, type DashboardCardId } from "@/lib/rbac/dashboard-cards";

export function AdminDashboardShell({
  permissions,
  userId,
  userRole,
  serviceRoleConfigured,
  loadedAt,
  metrics,
  snapshot,
  pendingCount,
  companyCards,
  investorActivity,
  crmActivity,
  operationalActivity,
  queueSummary,
  orchestrationCounts,
  scheduledCounts,
  executionSummary,
  automationSummary,
}: AdminCommandCenterProps) {
  const companyUpdateCount = companyCards.reduce((sum, company) => sum + company.company_updates_published_count, 0);
  const can = (id: DashboardCardId) => canSeeCard(id, permissions);

  // Collapsible like the WorkspaceSection cards — its own header (AdminCommandHeader)
  // gets a chevron; the body folds. Choice remembered per browser.
  const [open, setOpen] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restore collapsed choice after mount
  useEffect(() => { try { if (window.localStorage.getItem("cw.section.Operations Command Center") === "0") setOpen(false); } catch { /* ignore */ } }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { window.localStorage.setItem("cw.section.Operations Command Center", n ? "1" : "0"); } catch { /* ignore */ } return n; });

  return (
    <AdminActionHealthProvider
      userId={userId}
      userRole={userRole}
      serviceRoleConfigured={serviceRoleConfigured}
    >
      <WorkspacePageContainer>
        <div className="flex items-start gap-2">
          <button
            type="button" onClick={toggle} aria-expanded={open}
            aria-label={open ? "Collapse Operations Command Center" : "Expand Operations Command Center"}
            className="mt-1 shrink-0 rounded p-0.5 hover:bg-slate-100"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8"
              strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className="transition-transform duration-150" style={{ transform: open ? "rotate(90deg)" : "none" }}
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <AdminCommandHeader pendingCount={pendingCount} loadedAt={loadedAt} />
          </div>
        </div>

        <div className={open ? "space-y-6" : "hidden"}>
        {can("operations_control") ? (
          <AdminOperationsControl queueSummary={queueSummary} serviceRoleOk={serviceRoleConfigured} />
        ) : null}

        {can("kpi_grid") ? (
          <AdminKpiGrid metrics={metrics} snapshot={snapshot} serviceRoleConfigured={serviceRoleConfigured} />
        ) : null}

        {orchestrationCounts && can("orchestration_visibility") ? (
          <AdminOrchestrationVisibility
            counts={orchestrationCounts}
            scheduledCounts={scheduledCounts}
            executionSummary={executionSummary}
            automationSummary={automationSummary}
            isStaff={userRole === "admin" || userRole === "analyst"}
          />
        ) : null}

        {can("activity_graph") ? (
          <AdminPlatformActivityGraph
            crmActivity={crmActivity}
            investorActivity={investorActivity}
            companyUpdateCount={companyUpdateCount}
          />
        ) : null}

        {can("investor_activity") ? (
          <AdminInvestorActivityPanels investorActivity={investorActivity} />
        ) : null}

        {can("recent_activity") ? (
          <AdminRecentActivityTimeline activities={operationalActivity} />
        ) : null}

        {can("platform_overview") ? (
          <AdminPlatformOverview companyCards={companyCards} snapshot={snapshot} />
        ) : null}

        {can("system_health") ? <AdminSystemHealthSection /> : null}
        </div>
      </WorkspacePageContainer>
    </AdminActionHealthProvider>
  );
}
