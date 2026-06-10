import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { formatError } from "@/lib/errors/format-error";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listFounderCompanyUpdates } from "@/lib/company-updates/company-updates";
import { FounderCompanyUpdatesPanel } from "@/components/FounderCompanyUpdatesPanel";
import { FounderSpvStatusPanel } from "@/components/FounderSpvStatusPanel";
import { listFounderChecklistSummary } from "@/lib/spv/checklist";
import { listFounderClosingSummaries } from "@/lib/spv/closing-reviews";
import { listFounderPackageSummaries } from "@/lib/spv/document-packages";
import { listFounderSpvSummary } from "@/lib/spv/spv-workflow";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import type { Company } from "@/lib/supabase/types";

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
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Founder Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Capital Raise</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track indicative interest, pledge totals, and marketplace raise status.
        </p>
      </div>

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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Indicative Interest"
              value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
              detail={`From ${pledgeSummary.investorCount} ${pledgeSummary.investorCount === 1 ? "investor" : "investors"}`}
              accent="indigo"
              href="/founder/investors"
            />
            <MetricCard
              label="Raise Status"
              value={raiseStatus}
              detail={company.is_published ? "Live on marketplace" : "Not yet published"}
              accent="violet"
              href="/founder/capital-raise"
            />
            <MetricCard
              label="Funding Target"
              value={company.funding_amount ? formatPledgeTotal(Number(company.funding_amount)) : "TBD"}
              detail="Company funding goal"
              accent="blue"
              href="/founder/settings"
            />
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title="Capital Raise Overview" subtitle="Non-binding marketplace interest">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100">
                  <p className="text-sm font-medium text-indigo-700">Total pledged</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <p className="text-sm font-medium text-slate-600">Investor count</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{pledgeSummary.investorCount}</p>
                </div>
              </div>
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

            <WorkspacePanel title="Recent investor activity" subtitle="Interest tied to your listing">
              {activityError ? (
                <p className="text-sm text-red-700">Activity query failed: {activityError}</p>
              ) : !investorActivity || investorActivity.interests.length === 0 ? (
                <p className="text-sm text-amber-900">
                  Activity query succeeded but returned 0 interest records for company_id={company.id}.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {investorActivity.interests.map((raw) => {
                    const row = raw as {
                      id: string;
                      status?: string | null;
                      created_at?: string;
                      profiles?: { full_name?: string | null; email?: string | null } | null;
                    };
                    const investor = row.profiles?.full_name ?? row.profiles?.email ?? "Unknown investor";
                    const date = row.created_at
                      ? new Date(row.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })
                      : "—";
                    return (
                      <div key={row.id} className="py-3 text-sm">
                        <p className="font-medium text-slate-900">{investor}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.status ?? "interested"} · {date}
                        </p>
                      </div>
                    );
                  })}
                </div>
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
