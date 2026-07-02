import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { getTranslations } from "next-intl/server";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
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
import { FounderProfileViewsCard } from "@/components/founder/FounderProfileViewsCard";

export const dynamic = "force-dynamic";

export default async function FounderCapitalRaisePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

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
      <FounderJourneyGate minStage="deploy">
      <FounderFeatureGate featureKey="capital_raise">
        <PageHeader
          eyebrow={t("founder_workspace_2")}
          title={t("capital_raise")}
          description={t("track_indicative_interest_pledge_totals_and_ma")}
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
        <WorkspacePanel title={t("company_profile_required")} subtitle={t("link_a_company_to_track_capital_raise_progress")}>
          <FounderEmptyState
            icon="💰"
            title={t("complete_your_profile_to_track_your_raise")}
            description={t("set_your_funding_target_publish_your_company_p")}
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

          {/* Investor view signals + AI Round Health Advisor */}
          <section className="mt-8 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RoundHealthAdvisor />
            </div>
            <FounderProfileViewsCard companyId={company.id} />
          </section>

          {/* Round structure calculator */}
          <section className="mt-8">
            <RoundStructureCalculator />
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title={t("capital_raise_overview")} subtitle={t("non_binding_marketplace_interest")}>
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

            <WorkspacePanel title={t("investor_pipeline_2")} subtitle={t("interest_tied_to_your_listing")}>
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
                  title={t("no_investor_activity_yet")}
                  description={t("investor_interests_intro_requests_and_saved_de")}
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
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
