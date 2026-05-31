"use client";

import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCommandHeader } from "@/components/admin/dashboard/AdminCommandHeader";
import { AdminInvestorActivityPanels } from "@/components/admin/dashboard/AdminInvestorActivityPanels";
import { AdminKpiGrid } from "@/components/admin/dashboard/AdminKpiGrid";
import { AdminOperationsControl } from "@/components/admin/dashboard/AdminOperationsControl";
import { AdminPlatformActivityGraph } from "@/components/admin/dashboard/AdminPlatformActivityGraph";
import { AdminPlatformOverview } from "@/components/admin/dashboard/AdminPlatformOverview";
import { AdminRecentActivityTimeline } from "@/components/admin/dashboard/AdminRecentActivityTimeline";
import { AdminSystemHealthSection } from "@/components/admin/dashboard/AdminSystemHealthSection";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import type { AdminCommandCenterProps } from "@/components/admin/dashboard/types";

export function AdminDashboardShell({
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
}: AdminCommandCenterProps) {
  const companyUpdateCount = companyCards.reduce((sum, company) => sum + company.company_updates_published_count, 0);

  return (
    <AdminActionHealthProvider
      userId={userId}
      userRole={userRole}
      serviceRoleConfigured={serviceRoleConfigured}
    >
      <WorkspacePageContainer>
        <AdminCommandHeader pendingCount={pendingCount} loadedAt={loadedAt} />

        <AdminKpiGrid metrics={metrics} snapshot={snapshot} serviceRoleConfigured={serviceRoleConfigured} />

        <AdminOperationsControl
          pendingReviews={metrics.pendingReviews}
          pendingInvestorApprovals={snapshot.pendingInvestorApprovals}
          openComplianceEvents={snapshot.openComplianceEvents}
          spvPipelineCount={snapshot.spvPipelineCount}
          reportsGenerated={snapshot.reportsGenerated}
          serviceRoleOk={serviceRoleConfigured}
        />

        <AdminPlatformActivityGraph
          crmActivity={crmActivity}
          investorActivity={investorActivity}
          companyUpdateCount={companyUpdateCount}
        />

        <AdminInvestorActivityPanels investorActivity={investorActivity} />

        <AdminRecentActivityTimeline activities={operationalActivity} />

        <AdminPlatformOverview companyCards={companyCards} snapshot={snapshot} />

        <AdminSystemHealthSection />
      </WorkspacePageContainer>
    </AdminActionHealthProvider>
  );
}
