import { AppShell } from "@/components/AppShell";
import { AdminDashboardShell } from "@/components/AdminDashboardShell";
import { getAdminDashboardMetrics, listAdminCompanies, mapAdminCompaniesToCardData } from "@/lib/data/admin";
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
  const subscriptionsByProfileId = await listSubscriptionsByProfileIds(founderIds);
  const companyCards = mapAdminCompaniesToCardData(companies, subscriptionsByProfileId);

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
