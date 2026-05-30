import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildFounderInvestorCrmView, type FounderInvestorRelationRow } from "@/lib/data/investor-crm";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPipelineStage(stage: string | null) {
  if (!stage) {
    return null;
  }

  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAmountRow(row: FounderInvestorRelationRow) {
  if (row.pledgeAmount != null && row.pledgeAmount > 0) {
    return formatPledgeTotal(row.pledgeAmount, row.pledgeCurrency ?? "USD");
  }

  if (row.interestAmount != null && row.interestAmount > 0) {
    return formatPledgeTotal(row.interestAmount, row.pledgeCurrency ?? "USD");
  }

  return null;
}

function FounderInvestorRelationCard({ row }: Readonly<{ row: FounderInvestorRelationRow }>) {
  const amount = formatAmountRow(row);
  const pipelineStage = formatPipelineStage(row.pipelineStage);

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{row.investorName}</p>
          {row.investorEmail ? <p className="text-xs text-slate-500">{row.investorEmail}</p> : null}
        </div>
        <p className="text-xs text-slate-500">{formatActivityDate(row.lastActivityAt)}</p>
      </div>
      <p className="mt-2 text-sm text-slate-700">{row.actionLabel}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {row.status ? <span>Status: {row.status}</span> : null}
        {pipelineStage ? <span>Stage: {pipelineStage}</span> : null}
        {amount ? <span>Amount: {amount}</span> : null}
      </div>
      {row.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{row.notes}</p> : null}
    </div>
  );
}

function FounderInvestorSection({
  title,
  subtitle,
  rows,
}: Readonly<{
  title: string;
  subtitle: string;
  rows: FounderInvestorRelationRow[];
}>) {
  return (
    <WorkspacePanel title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No records in this section yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <FounderInvestorRelationCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </WorkspacePanel>
  );
}

export default async function FounderInvestorsPage() {
  const profile = await requireRole(["founder"]);
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
      <FounderFeatureGate featureKey="investor_access">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Founder Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Investors</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track inbound investor interest, pledges, intro requests, and follow-ups for your company.
        </p>
      </div>

      {!company ? (
        <WorkspacePanel title="Company profile required" subtitle="Link a company to view investor activity">
          <p className="text-sm text-slate-600">
            Complete your company setup to see investor relationship activity here.
          </p>
        </WorkspacePanel>
      ) : !crmView || crmView.isEmpty ? (
        <WorkspacePanel title="Investor CRM" subtitle={company.company_name}>
          <p className="text-sm leading-6 text-slate-600">
            No investor activity yet. Investor activity will appear here when investors save, express interest,
            pledge, or request an intro for your company.
          </p>
        </WorkspacePanel>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Interested investors"
              value={String(crmView.summary.totalInterestedInvestors)}
              detail="Unique investors with interest, saves, or intro activity"
              accent="indigo"
            />
            <MetricCard
              label="Pledged / indicative"
              value={crmView.summary.totalPledgedDisplay}
              detail={
                crmView.summary.totalIndicativeInterestDisplay
                  ? `${crmView.summary.totalIndicativeInterestDisplay} indicative interest declared`
                  : "Total pledged amount from investor interests"
              }
              accent="violet"
            />
            <MetricCard
              label="Intro requests"
              value={String(crmView.summary.introRequests)}
              detail="Investors who requested an introduction"
              accent="blue"
            />
            <MetricCard
              label="Follow-ups needed"
              value={String(crmView.summary.followUpsNeeded)}
              detail="Investors waiting on founder or platform follow-up"
              accent="slate"
            />
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <FounderInvestorSection
              title="New Interest"
              subtitle="Investors who recently expressed interest"
              rows={crmView.sections.newInterest}
            />
            <FounderInvestorSection
              title="Pledged / Indicative Interest"
              subtitle="Investors with pledge or indicative amounts"
              rows={crmView.sections.pledged}
            />
            <FounderInvestorSection
              title="Intro Requested"
              subtitle="Investors requesting a warm introduction"
              rows={crmView.sections.introRequested}
            />
            <FounderInvestorSection
              title="Follow-up Needed"
              subtitle="Investors waiting on follow-up"
              rows={crmView.sections.followUpNeeded}
            />
          </section>

          <section className="mt-6">
            <FounderInvestorSection
              title="Recent Investor Activity"
              subtitle="Latest actions across your investor pipeline"
              rows={crmView.sections.recentActivity}
            />
          </section>
        </>
      )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
