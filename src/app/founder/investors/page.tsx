import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderInvestorHubPanels } from "@/components/FounderInvestorHubPanels";
import { FounderInvestorsModuleViews } from "@/components/founder/FounderInvestorsModuleViews";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildFounderInvestorCrmView } from "@/lib/data/investor-crm";
import { loadFounderInvestorHub } from "@/lib/founder-crm/load-founder-investor-hub";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderInvestorsPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  let crmView: ReturnType<typeof buildFounderInvestorCrmView> | null = null;
  let hub: Awaited<ReturnType<typeof loadFounderInvestorHub>> | null = null;

  if (company) {
    const supabase = await createServerSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const [activity, pledgeSummary, hubData] = await Promise.all([
      listFounderInvestorActivity(supabase, company.id),
      getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId),
      loadFounderInvestorHub(company, profile.id),
    ]);

    crmView = buildFounderInvestorCrmView(activity, pledgeSummary);
    hub = hubData;
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="investor_access">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Founder Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Investors</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Private investor CRM, controlled outreach, and platform investor activity for your company.
        </p>
      </div>

      {!company ? (
        <WorkspacePanel title="Company profile required" subtitle="Link a company to view investor activity">
          <p className="text-sm text-slate-600">
            Complete your company setup to see investor relationship activity here.
          </p>
        </WorkspacePanel>
      ) : (
        <>
          {hub ? (
            <section className="mb-8">
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
              />
            </section>
          ) : null}

          {!crmView || crmView.isEmpty ? (
            <WorkspacePanel title="Platform investor activity" subtitle={company.company_name}>
              <p className="text-sm leading-6 text-slate-600">
                No platform investor activity yet. Inbound interest will appear here when registered investors
                engage with your listing.
              </p>
            </WorkspacePanel>
          ) : (
            <FounderInvestorsModuleViews crmView={crmView} companyName={company.company_name} />
          )}
        </>
      )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
