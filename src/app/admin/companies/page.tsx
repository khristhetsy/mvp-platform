import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { AdminActionHealthProvider } from "@/components/AdminActionHealthProvider";
import { AdminCompaniesModuleViews } from "@/components/admin/AdminCompaniesModuleViews";
import { AdminPendingQuickReview } from "@/components/admin/AdminPendingQuickReview";
import { AdminStageApprovalQueue } from "@/components/admin/AdminStageApprovalQueue";
import type { PendingFounder } from "@/components/admin/AdminStageApprovalQueue";
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
import { computeReadinessScore } from "@/lib/data/founder-readiness";

export const dynamic = "force-dynamic";

type PendingProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  stage_approval_requested_at: string | null;
};

type CompanyRow = {
  founder_id: string | null;
  company_name: string | null;
};

type FounderDocumentRow = {
  uploaded_by: string | null;
  document_type: string | null;
};

export default async function AdminCompaniesPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const t = await getTranslations("adminPages");
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let loadError: string | null = null;
  let companyCards = mapAdminCompaniesToCardData([]);
  let pendingFounders: PendingFounder[] = [];

  try {
    const supabase = createServiceRoleClient();

    // Query pending stage approvals (qualify → deploy)
    const rawSupabase = supabase as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;
    const { data: pendingProfilesRaw } = await rawSupabase
      .from("profiles")
      .select("id, full_name, email, stage_approval_requested_at")
      .eq("journey_stage", "qualify")
      .eq("stage_approval_status", "pending");

    const pendingProfiles = (pendingProfilesRaw ?? []) as PendingProfileRow[];

    if (pendingProfiles.length > 0) {
      const founderProfileIds = pendingProfiles.map((p) => p.id);
      const { data: companiesForFoundersRaw } = await rawSupabase
        .from("companies")
        .select("founder_id, company_name")
        .in("founder_id", founderProfileIds);

      const companiesForFounders = (companiesForFoundersRaw ?? []) as CompanyRow[];
      const companyNameByFounderId = new Map<string, string>();
      for (const c of companiesForFounders) {
        if (c.founder_id) {
          companyNameByFounderId.set(c.founder_id, c.company_name ?? "");
        }
      }

      // Compute each founder's readiness the same way the founder view does,
      // so the queue shows the real number (readiness_score is not a profiles
      // column — selecting it previously errored the whole query and left the
      // queue permanently empty).
      const { data: docsRaw } = await rawSupabase
        .from("documents")
        .select("uploaded_by, document_type")
        .in("uploaded_by", founderProfileIds);
      const docs = (docsRaw ?? []) as FounderDocumentRow[];
      const docTypesByFounderId = new Map<string, string[]>();
      for (const doc of docs) {
        if (!doc.uploaded_by) continue;
        const list = docTypesByFounderId.get(doc.uploaded_by) ?? [];
        if (doc.document_type) list.push(doc.document_type);
        docTypesByFounderId.set(doc.uploaded_by, list);
      }

      pendingFounders = pendingProfiles.map((p) => ({
        profileId: p.id,
        fullName: p.full_name,
        email: p.email,
        companyName: companyNameByFounderId.get(p.id) ?? null,
        requestedAt: p.stage_approval_requested_at ?? "",
        readinessScore: computeReadinessScore(docTypesByFounderId.get(p.id) ?? []),
      }));
    }

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
            eyebrow={t("adminWorkspace2")}
            title={t("companies")}
            description={t("reviewSubmissionsManagePublication")}
          />

          <AdminStageApprovalQueue founders={pendingFounders} />

          <AdminPendingQuickReview
            companies={companyCards
              .filter((c) => c.review_status === "pending")
              .map((c) => ({
                id: c.id,
                company_name: c.company_name,
                review_status: c.review_status,
                created_at: c.created_at,
                industry: c.industry,
                readinessScore: c.founder_onboarding_percent ?? null,
              }))}
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
