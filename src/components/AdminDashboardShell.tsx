"use client";

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

  return (
    <AdminActionHealthProvider
      userId={userId}
      userRole={userRole}
      serviceRoleConfigured={serviceRoleConfigured}
    >
      <WorkspacePageContainer>
        <AdminCommandHeader pendingCount={pendingCount} loadedAt={loadedAt} />

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
      </WorkspacePageContainer>
    </AdminActionHealthProvider>
  );
}
