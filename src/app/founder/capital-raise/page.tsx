import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { formatError, RouteDataDiagnostics } from "@/components/RouteDataDiagnostics";
import { WorkspacePanel } from "@/components/WorkspacePanel";
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
    <AppShell
      role="FOUNDER"
      workspace="founder"
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <RouteDataDiagnostics
        route="/founder/capital-raise"
        userId={profile.id}
        profileRole={profile.role}
        companyId={company?.id ?? null}
        entries={[
          {
            dataFunction: "ensureFounderCompanyForUser()",
            count: company ? 1 : 0,
            error: companyError,
          },
          {
            dataFunction: "getCompanyPledgeSummary() via getFounderPledgeCompanyId()",
            count: pledgeSummary.investorCount,
            error: pledgeError,
            note: `totalPledged=${pledgeSummary.totalPledged}`,
          },
          {
            dataFunction: "listFounderInvestorActivity()",
            count: investorActivity?.interests.length ?? 0,
            error: activityError,
          },
        ]}
      />

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
            />
            <MetricCard
              label="Raise Status"
              value={raiseStatus}
              detail={company.is_published ? "Live on marketplace" : "Not yet published"}
              accent="violet"
            />
            <MetricCard
              label="Funding Target"
              value={company.funding_amount ? formatPledgeTotal(Number(company.funding_amount)) : "TBD"}
              detail="Company funding goal"
              accent="blue"
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
        </>
      )}
    </AppShell>
  );
}
