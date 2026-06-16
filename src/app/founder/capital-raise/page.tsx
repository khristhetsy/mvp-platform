import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatError } from "@/lib/errors/format-error";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listFounderCompanyUpdates } from "@/lib/company-updates/company-updates";
import { FounderCompanyUpdatesPanel } from "@/components/FounderCompanyUpdatesPanel";
import { FounderInvestorPipelineKanban } from "@/components/FounderInvestorPipelineKanban";
import { FounderSpvStatusPanel } from "@/components/FounderSpvStatusPanel";
import { listFounderChecklistSummary } from "@/lib/spv/checklist";
import { listFounderClosingSummaries } from "@/lib/spv/closing-reviews";
import { listFounderPackageSummaries } from "@/lib/spv/document-packages";
import { listFounderSpvSummary } from "@/lib/spv/spv-workflow";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import type { Company } from "@/lib/supabase/types";
import { CapitalRaiseCardsClient } from "@/components/founder/CapitalRaiseCardsClient";
import { CapitalRaiseOverviewClient } from "@/components/founder/CapitalRaiseOverviewClient";

export const dynamic = "force-dynamic";

export default async function FounderCapitalRaisePage() {
  const profile = await requireRole(["founder"]);

  let company: Company | null = null;
  let companyError: string | null = null;
  let pledgeError: string | null = null;
  let activityError: string | null = null;
  let pledgeSummary = { totalPledged: 0, investorCount: 0, currency: "USD" };
  let investorActivity: Awaited<ReturnType<typeof listFounderInvestorActivity>> | null = null;
  let companyUpdates: Awaited<ReturnType<typeof listFounderCompanyUpdates>>["data"] = [];
  let spvOpportunities: Awaited<ReturnType<typeof listFounderSpvSummary>>["opportunities"] = [];
  let spvParticipations: Awaited<ReturnType<typeof listFounderSpvSummary>>["participations"] = [];
  let spvChecklistSummaryBySpv: Awaited<ReturnType<typeof listFounderChecklistSummary>>["data"] = {};
  let spvPackageSummaryBySpv: Awaited<ReturnType<typeof listFounderPackageSummaries>>["data"] = {};
  let spvClosingSummaryBySpv: Awaited<ReturnType<typeof listFounderClosingSummaries>>["data"] = {};
  let spvExecutionSummaryBySpv: Record<
    string,
    { executionPct: number; signerPct: number; nextStep: string }
  > = {};

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

    try {
      const supabase = await createServerSupabaseClient();
      const updatesResult = await listFounderCompanyUpdates(supabase, company.id);
      companyUpdates = updatesResult.data ?? [];
    } catch {
      companyUpdates = [];
    }

    try {
      const supabase = await createServerSupabaseClient();
      const spvSummary = await listFounderSpvSummary(supabase, company.id);
      spvOpportunities = spvSummary.opportunities;
      spvParticipations = spvSummary.participations;

      const checklistSummary = await listFounderChecklistSummary(
        supabase,
        spvOpportunities.map((spv) => spv.id),
      );
      spvChecklistSummaryBySpv = checklistSummary.data ?? {};

      const packageSummary = await listFounderPackageSummaries(
        supabase,
        spvOpportunities.map((spv) => spv.id),
      );
      spvPackageSummaryBySpv = packageSummary.data ?? {};

      const closingSummary = await listFounderClosingSummaries(
        supabase,
        spvOpportunities.map((spv) => spv.id),
      );
      spvClosingSummaryBySpv = closingSummary.data ?? {};

      for (const spv of spvOpportunities) {
        const pkg = spvPackageSummaryBySpv[spv.id];
        const partsForSpv = spvParticipations.filter((p) => p.spv_opportunity_id === spv.id);
        const activeCount = partsForSpv.filter((p) => !["declined", "canceled"].includes(p.status)).length;
        const readyCount = spv.investors_document_ready_count ?? 0;
        spvExecutionSummaryBySpv[spv.id] = {
          executionPct: spv.package_readiness_pct ?? pkg?.readinessPct ?? 0,
          signerPct:
            activeCount > 0 ? Math.round((readyCount / activeCount) * 100) : 0,
          nextStep:
            "Complete operational packages and investor requirements — DocuSign not connected (readiness only)",
        };
      }
    } catch {
      spvOpportunities = [];
      spvParticipations = [];
      spvChecklistSummaryBySpv = {};
      spvPackageSummaryBySpv = {};
      spvClosingSummaryBySpv = {};
      spvExecutionSummaryBySpv = {};
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

          <section className="mt-8">
            <FounderSpvStatusPanel
              opportunities={spvOpportunities}
              participations={spvParticipations}
              checklistSummaryBySpv={spvChecklistSummaryBySpv ?? {}}
              packageSummaryBySpv={spvPackageSummaryBySpv ?? {}}
              closingSummaryBySpv={spvClosingSummaryBySpv ?? {}}
              executionSummaryBySpv={spvExecutionSummaryBySpv}
            />
          </section>

          <section className="mt-8">
            <FounderCompanyUpdatesPanel initialUpdates={companyUpdates} />
          </section>
        </>
      )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
