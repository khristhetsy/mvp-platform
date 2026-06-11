import { AppShell } from "@/components/AppShell";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCompaniesModuleViews } from "@/components/admin/AdminCompaniesModuleViews";
import { formatError } from "@/lib/errors/format-error";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { listAdminCompanies, mapAdminCompaniesToCardData } from "@/lib/data/admin";
import { getCompanyMatchingSummaries } from "@/lib/matching/admin-matching-summaries";
import { getLearningAdminSummaryForCompanies } from "@/lib/learning/progress";
import { getCompanyUpdateAdminSummaries } from "@/lib/company-updates/company-updates";
import { getRemediationSummaryForCompanies } from "@/lib/remediation/tasks";
import { getRequestedPlansByProfileIds } from "@/lib/billing/requested-plan";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let loadError: string | null = null;
  let companyCards = mapAdminCompaniesToCardData([]);

  try {
    const supabase = createServiceRoleClient();
    const companies = await listAdminCompanies(supabase);
    const founderIds = companies.map((company) => company.founder_id).filter(Boolean);
    const companyIds = companies.map((company) => company.id);
    const [subscriptionsByProfileId, requestedPlansByProfileId, remediationSummaries, learningSummaries, matchingSummaries, updateSummaries] =
      await Promise.all([
        listSubscriptionsByProfileIds(founderIds),
        getRequestedPlansByProfileIds(founderIds),
        getRemediationSummaryForCompanies(companyIds),
        getLearningAdminSummaryForCompanies(companyIds),
        getCompanyMatchingSummaries(companyIds),
        getCompanyUpdateAdminSummaries(companyIds),
      ]);
    const remediationByCompanyId = new Map(
      [...remediationSummaries.entries()].map(([id, summary]) => [
        id,
        { active: summary.active, total: summary.total },
      ]),
    );
    companyCards = mapAdminCompaniesToCardData(
      companies,
      subscriptionsByProfileId,
      requestedPlansByProfileId,
      remediationByCompanyId,
      learningSummaries,
      matchingSummaries,
      updateSummaries,
    );
  } catch (error) {
    loadError = formatError(error);
  }

  const pendingCount = companyCards.filter((company) => company.review_status === "pending").length;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <AdminActionHealthProvider
        userId={profile.id}
        userRole={profile.role}
        serviceRoleConfigured={serviceRoleConfigured}
      >
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Admin workspace"
            title="Companies"
            description="Review submissions, manage publication, and control marketplace visibility."
          />

          <AdminCompaniesModuleViews
            companies={companyCards}
            loadError={loadError}
            pendingCount={pendingCount}
          />
        </WorkspacePageContainer>
      </AdminActionHealthProvider>
    </AppShell>
  );
}
