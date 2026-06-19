import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatError } from "@/lib/errors/format-error";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { FounderInvestorPipelineKanban } from "@/components/FounderInvestorPipelineKanban";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import type { Company } from "@/lib/supabase/types";
import { CapitalRaiseCardsClient } from "@/components/founder/CapitalRaiseCardsClient";
import { CapitalRaiseOverviewClient } from "@/components/founder/CapitalRaiseOverviewClient";
import { RoundStructureCalculator } from "@/components/founder/RoundStructureCalculator";
import { RoundHealthAdvisor } from "@/components/founder/RoundHealthAdvisor";
import { FounderEmptyState } from "@/components/founder/FounderEmptyState";

export const dynamic = "force-dynamic";

export default async function FounderCapitalRaisePage() {
  const profile = await requireRole(["founder"]);

  let company: Company | null = null;
  let companyError: string | null = null;
  let pledgeError: string | null = null;
  let activityError: string | null = null;
  let pledgeSummary = { totalPledged: 0, investorCount: 0, currency: "USD" };
  let investorActivity: Awaited<ReturnType<typeof listFounderInvestorActivity>> | null = null;

  try {
    company = await ensureFounderCompanyForUser(profile);
  } catch (error) {
    companyError = formatError(error);
  }

  if (company) {
    try {
      const serviceSupabase = createServiceRoleClient();
      const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
      pledgeSummary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
    } catch (error) {
      pledgeError = formatError(error);
    }

    try {
      const supabase = await createServerSupabaseClient();
      investorActivity = await listFounderInvestorActivity(supabase, company.id);
    } catch (error) {
      activityError = formatError(error);
    }

  }

  const raiseStatus = company?.is_published ? "Published" : (company?.review_status ?? company?.status ?? "Draft");

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="capital_raise">
        <PageHeader
          eyebrow="Founder workspace"
          title="Capital raise"
          description="Track indicative interest, pledge totals, and marketplace raise status."
        />

      {companyError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Company load failed: {companyError}
        </div>
      ) : null}

      {pledgeError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Pledge query failed: {pledgeError}
        </div>
      ) : null}

      {!company ? (
        <WorkspacePanel title="Company profile required" subtitle="Link a company to track capital raise progress">
          <FounderEmptyState
            icon="💰"
            title="Complete your profile to track your raise"
            description="Set your funding target, publish your company profile, and start receiving indicative interest from investors on the platform."
            action={{ label: "Complete onboarding", href: "/founder/onboarding" }}
            secondaryAction={{ label: "Company settings", href: "/founder/settings" }}
          />
        </WorkspacePanel>
      ) : (
        <>
          <CapitalRaiseCardsClient
            pledgeSummary={pledgeSummary}
            company={{
              funding_amount: company.funding_amount ? Number(company.funding_amount) : null,
              is_published: company.is_published ?? false,
              review_status: company.review_status ?? null,
              status: company.status ?? null,
            }}
            investorActivity={investorActivity}
            raiseStatus={raiseStatus}
          />

          {/* AI Round Health Advisor */}
          <section className="mt-8">
            <RoundHealthAdvisor />
          </section>

          {/* Round structure calculator */}
          <section className="mt-8">
            <RoundStructureCalculator />
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title="Capital Raise Overview" subtitle="Non-binding marketplace interest">
              <CapitalRaiseOverviewClient
                pledgeSummary={pledgeSummary}
                investorActivity={investorActivity}
                fundingAmount={company.funding_amount ? Number(company.funding_amount) : null}
              />
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Pledges are indicative and not legally committed investment.
                {pledgeSummary.totalPledged === 0 && !pledgeError && (
                  <>{" "}Publish your company profile to start receiving interest.</>
                )}
              </p>
            </WorkspacePanel>

            <WorkspacePanel title="Investor pipeline" subtitle="Interest tied to your listing">
              {activityError ? (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  Could not load investor activity. Please refresh or contact support.
                </div>
              ) : !investorActivity ||
                (investorActivity.interests.length === 0 &&
                  investorActivity.introRequests.length === 0 &&
                  investorActivity.savedDeals.length === 0) ? (
                <FounderEmptyState
                  icon="🎯"
                  title="No investor activity yet"
                  description="Investor interests, intro requests, and saved deals appear here once your company is published and investors engage with your listing."
                  action={{ label: "Publish your profile", href: "/founder/settings" }}
                />
              ) : (
                <FounderInvestorPipelineKanban activity={investorActivity} />
              )}
            </WorkspacePanel>
          </section>


        </>
      )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
