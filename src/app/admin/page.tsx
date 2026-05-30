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
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const supabase = createServiceRoleClient();

  const [metrics, companies, investorActivity, crmActivity] = await Promise.all([
    getAdminDashboardMetrics(supabase),
    listAdminCompanies(supabase),
    listAdminInvestorActivity(supabase),
    listRecentInvestorCrmActivity(supabase),
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
        metrics={metrics}
        pendingCount={pendingCompanies.length}
        companyCards={companyCards}
        investorActivity={investorActivity}
        crmActivity={crmActivity}
      />
    </AppShell>
  );
}
