import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { FounderInvestorsModuleViews } from "@/components/founder/FounderInvestorsModuleViews";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildFounderInvestorCrmView } from "@/lib/data/investor-crm";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderInvestorsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  let crmView: ReturnType<typeof buildFounderInvestorCrmView> | null = null;

  if (company) {
    const supabase = await createServerSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const [activity, pledgeSummary] = await Promise.all([
      listFounderInvestorActivity(supabase, company.id),
      getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId),
    ]);
    crmView = buildFounderInvestorCrmView(activity, pledgeSummary);
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderJourneyGate minStage="deploy">
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("investors")}
            title={t("overview")}
            description={t("platform_investor_activity_pipeline_summary_an")}
          />

          {!company ? (
            <WorkspacePanel title={t("company_profile_required")} subtitle={t("link_a_company_to_view_investor_activity")}>
              <p className="text-sm text-slate-600">
                Complete your company setup to see investor relationship activity here.
              </p>
            </WorkspacePanel>
          ) : !crmView || crmView.isEmpty ? (
            <WorkspacePanel title={t("platform_investor_activity")} subtitle={company.company_name}>
              <p className="text-sm leading-6 text-slate-600">
                No platform investor activity yet. Inbound interest will appear here when registered investors
                engage with your listing.
              </p>
            </WorkspacePanel>
          ) : (
            <FounderInvestorsModuleViews crmView={crmView} companyName={company.company_name} />
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
