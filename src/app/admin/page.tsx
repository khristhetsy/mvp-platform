import { AppShell } from "@/components/AppShell";
import { AdminDashboardShell } from "@/components/AdminDashboardShell";
import { getAdminDashboardMetrics, listAdminCompanies, mapAdminCompaniesToCardData } from "@/lib/data/admin";
import { getCompanyMatchingSummaries } from "@/lib/matching/admin-matching-summaries";
import { getLearningAdminSummaryForCompanies } from "@/lib/learning/progress";
import { getRemediationSummaryForCompanies } from "@/lib/remediation/tasks";
import { getRequestedPlansByProfileIds } from "@/lib/billing/requested-plan";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";
import { listRecentInvestorCrmActivity } from "@/lib/data/investor-crm";
import { listAdminInvestorActivity } from "@/lib/data/investor-interests";
import { getComplianceMetrics } from "@/lib/compliance/events";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();
  const loadedAt = new Date().toISOString();

  const [
    metrics,
    companies,
    investorActivity,
    crmActivity,
    compliance,
    investorCount,
    pendingInvestorApprovals,
    pendingUpgrades,
    spvPipeline,
    reportsGenerated,
    notificationCount,
  ] = await Promise.all([
    getAdminDashboardMetrics(supabase),
    listAdminCompanies(supabase),
    listAdminInvestorActivity(supabase),
    listRecentInvestorCrmActivity(supabase),
    getComplianceMetrics(supabase),
    supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "investor"),
    supabase.from("investor_profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    supabase.from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("spv_opportunities").select("id", { count: "exact", head: true }).neq("status", "closed"),
    supabase.from("diligence_reports").select("id", { count: "exact", head: true }),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
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
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
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
      />
    </AppShell>
  );
}
