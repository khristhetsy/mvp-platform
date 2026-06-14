import { AppShell } from "@/components/AppShell";
import { AdminDashboardShell } from "@/components/AdminDashboardShell";
import { getAdminDashboardMetrics, listAdminCompanies, mapAdminCompaniesToCardData } from "@/lib/data/admin";
import { getCompanyMatchingSummaries } from "@/lib/matching/admin-matching-summaries";
import { getLearningAdminSummaryForCompanies } from "@/lib/learning/progress";
import { getRemediationSummaryForCompanies } from "@/lib/remediation/tasks";
import { getRequestedPlansByProfileIds } from "@/lib/billing/requested-plan";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import { getAdminQueueSummary } from "@/lib/queues/admin-queues";
import { listRecentInvestorCrmActivity } from "@/lib/data/investor-crm";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { getComplianceMetrics } from "@/lib/compliance/events";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getAdminOrchestrationCounts } from "@/lib/notifications/orchestration/summaries";
import { loadAdminOrchestrationExecutionSummary } from "@/lib/notifications/orchestration/execution-log";
import { getScheduledOperationalCounts } from "@/lib/notifications/scheduled/summaries";
import { getAutomationDailySummary } from "@/lib/automation/automation-log";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();
  const loadedAt = new Date().toISOString();
  const adminRole = profile.role === "analyst" ? "analyst" : "admin";

  const [
    metrics,
    companies,
    investorActivity,
    crmActivity,
    operationalFeed,
    queueSummary,
    compliance,
    investorCount,
    pendingInvestorApprovals,
    pendingUpgrades,
    spvPipeline,
    reportsGenerated,
    notificationCount,
    nextBestActions,
    orchestrationCounts,
    scheduledCounts,
    executionSummary,
    automationSummary,
  ] = await Promise.all([
    getAdminDashboardMetrics(supabase),
    listAdminCompanies(supabase),
    listAdminInvestorActivity(supabase),
    listRecentInvestorCrmActivity(supabase),
    getOperationalActivityFeed(supabase, { limit: 30 }).catch(() => ({ items: [], total: 0, hasMore: false })),
    getAdminQueueSummary(supabase).catch(() => []),
    getComplianceMetrics(supabase),
    supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "investor"),
    supabase.from("investor_profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    supabase.from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("spv_opportunities").select("id", { count: "exact", head: true }).neq("status", "closed"),
    supabase.from("diligence_reports").select("id", { count: "exact", head: true }),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
    loadAndMergeNextBestActions({
      profile,
      supabase,
      options: { role: adminRole, limit: 5, sync: true },
    }),
    getAdminOrchestrationCounts(supabase),
    getScheduledOperationalCounts(supabase),
    loadAdminOrchestrationExecutionSummary().catch(() => ({
      lastRun: null,
      lastDigestAt: null,
      failedRunsToday: 0,
      remindersGeneratedToday: 0,
      overdueWorkflowCount: 0,
    })),
    getAutomationDailySummary(supabase).catch(() => ({
      automationsTriggeredToday: 0,
      blockedWorkflows: 0,
      dependenciesResolvedToday: 0,
      automationFailuresToday: 0,
      staleChains: 0,
    })),
  ]);

  const pendingCompanies = companies.filter((company) => company.review_status === "pending");

  const founderIds = companies.map((company) => company.founder_id).filter(Boolean);
  const companyIds = companies.map((company) => company.id);
  const [subscriptionsByProfileId, requestedPlansByProfileId, remediationSummaries, learningSummaries, matchingSummaries] =
    await Promise.all([
      listSubscriptionsByProfileIds(founderIds),
      getRequestedPlansByProfileIds(founderIds),
      getRemediationSummaryForCompanies(companyIds),
      getLearningAdminSummaryForCompanies(companyIds),
      getCompanyMatchingSummaries(companyIds),
    ]);
  const remediationByCompanyId = new Map(
    [...remediationSummaries.entries()].map(([id, summary]) => [
      id,
      { active: summary.active, total: summary.total },
    ]),
  );
  const companyCards = mapAdminCompaniesToCardData(
    companies,
    subscriptionsByProfileId,
    requestedPlansByProfileId,
    remediationByCompanyId,
    learningSummaries,
    matchingSummaries,
  );

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}>
      <div className="mb-6 rounded-xl px-5 py-4" style={{ background: "#0c2340" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: "#AFA9EC" }}>CapitalOS admin</p>
            <h1 className="text-lg font-medium text-white">Dashboard</h1>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#534AB7", color: "#EEEDFE" }}>
            {profile.role}
          </span>
        </div>
      </div>
      <div className="mb-6 px-1">
        <NextBestActionsPanel
          role={adminRole}
          initialActions={nextBestActions.actions}
          limit={5}
          showEscalate
          viewAllHref="/admin/actions?priority=critical"
        />
      </div>
      <AdminDashboardShell
        userId={profile.id}
        userRole={profile.role}
        serviceRoleConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
        loadedAt={loadedAt}
        metrics={metrics}
        snapshot={{
          totalInvestors: investorCount.count ?? 0,
          pendingInvestorApprovals: pendingInvestorApprovals.count ?? 0,
          openComplianceEvents: compliance.openEvents,
          pendingUpgradeRequests: pendingUpgrades.count ?? 0,
          spvPipelineCount: spvPipeline.count ?? 0,
          notificationCount: notificationCount.count ?? 0,
          reportsGenerated: reportsGenerated.count ?? 0,
        }}
        pendingCount={pendingCompanies.length}
        companyCards={companyCards}
        investorActivity={investorActivity}
        crmActivity={crmActivity}
        operationalActivity={operationalFeed.items}
        queueSummary={queueSummary}
        orchestrationCounts={orchestrationCounts}
        scheduledCounts={scheduledCounts}
        executionSummary={executionSummary}
        automationSummary={automationSummary}
      />
    </AppShell>
  );
}
