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
          <p className="text-sm text-red-700">ensureFounderCompanyForUser() returned null.</p>
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
              {pledgeError ? null : pledgeSummary.totalPledged === 0 ? (
                <p className="mt-4 text-sm text-amber-900">
                  Pledge query succeeded but total is 0 for company_id={company.id}.
                </p>
              ) : (
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Pledges are indicative and not legally committed investment.
                </p>
              )}
            </WorkspacePanel>

            <WorkspacePanel title="Investor pipeline" subtitle="Interest tied to your listing">
              {activityError ? (
                <p className="text-sm text-red-700">Activity query failed: {activityError}</p>
              ) : !investorActivity ? (
                <p className="text-sm text-amber-900">
                  Activity query succeeded but returned no data for company_id={company.id}.
                </p>
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
