import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderInvestorHubPanels } from "@/components/FounderInvestorHubPanels";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderInvestorHub } from "@/lib/founder-crm/load-founder-investor-hub";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderInvestorOutreachPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  let hub: Awaited<ReturnType<typeof loadFounderInvestorHub>> | null = null;

  if (company) {
    hub = await loadFounderInvestorHub(company, profile.id);
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Investors"
            title="Outreach & CRM"
            description="Private investor CRM, email outreach pipeline, and social drafts."
          />

          {!company ? (
            <WorkspacePanel title="Company profile required" subtitle="Link a company to manage outreach">
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
            <WorkspacePanel title="Outreach hub" subtitle="Loading…">
              <p className="text-sm text-slate-500">Unable to load outreach data.</p>
            </WorkspacePanel>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
