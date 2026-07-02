import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { FounderInvestorHubPanels } from "@/components/FounderInvestorHubPanels";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderInvestorHub } from "@/lib/founder-crm/load-founder-investor-hub";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { MilestoneCelebration, type MilestoneKey } from "@/components/founder/MilestoneCelebration";

export const dynamic = "force-dynamic";

export default async function FounderInvestorOutreachPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  let hub: Awaited<ReturnType<typeof loadFounderInvestorHub>> | null = null;

  if (company) {
    hub = await loadFounderInvestorHub(company, profile.id);
  }

  const outreachMilestones: MilestoneKey[] = [];
  if ((hub?.contacts ?? []).length > 0) outreachMilestones.push("first_contact_added");
  const SENT_STATUSES = new Set(["contacted", "responded", "meeting_scheduled", "selected"]);
  if ((hub?.targets ?? []).some((t) => SENT_STATUSES.has(t.status))) outreachMilestones.push("outreach_sent");

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("investors")}
            title={t("outreach_crm")}
            description={t("private_investor_crm_email_outreach_pipeline_a")}
          />

          <MilestoneCelebration achieved={outreachMilestones} />

          {!company ? (
            <WorkspacePanel title={t("company_profile_required")} subtitle={t("link_a_company_to_manage_outreach")}>
              <p className="text-sm text-slate-600">
                Complete your company setup to access outreach tools.
              </p>
            </WorkspacePanel>
          ) : hub ? (
            <FounderInvestorHubPanels
              companyName={company.company_name}
              contacts={hub.contacts}
              targets={hub.targets}
              campaigns={hub.campaigns}
              readiness={hub.readiness}
              platformMatches={hub.platformMatches}
              followUpCount={hub.followUpCount}
              socialDrafts={hub.socialDrafts}
              socialReadiness={hub.socialReadiness}
              companySnapshot={{
                companyName: company.company_name,
                industry: company.industry ?? null,
                businessDescription: company.business_description ?? null,
                revenueStage: company.revenue_stage ?? null,
                fundingAmount: company.funding_amount ? Number(company.funding_amount) : null,
                geography: [company.state, company.country].filter(Boolean).join(", ") || null,
                founderGoals: company.founder_goals ?? null,
              }}
            />
          ) : (
            <WorkspacePanel title={t("outreach_hub")} subtitle={t("loading_2")}>
              <p className="text-sm text-slate-500">{t("unable_to_load_outreach_data")}</p>
            </WorkspacePanel>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
