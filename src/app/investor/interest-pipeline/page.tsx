import { AppShell } from "@/components/AppShell";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatInterestAmount(
  pledgeAmount: number | null,
  interestAmount: number | null,
  pledgeCurrency: string | null,
) {
  if (pledgeAmount != null && Number(pledgeAmount) > 0) {
    return `Pledged ${formatPledgeTotal(Number(pledgeAmount), pledgeCurrency ?? "USD")}`;
  }

  if (interestAmount != null && Number(interestAmount) > 0) {
    return `Indicative ${formatPledgeTotal(Number(interestAmount), pledgeCurrency ?? "USD")}`;
  }

  return null;
}

export default async function InvestorInterestPipelinePage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace, crmActivity } = await loadInvestorWorkspacePageData(investorId, 20);

  const interests = workspace.interests;
  const introRequests = workspace.introRequests;

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="workspace-eyebrow">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Interest Pipeline</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track expressed interest, pledge amounts, intro requests, and follow-ups across marketplace listings.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Expressed interest" subtitle={`${interests.length} interest records`}>
          <div className="divide-y divide-slate-100">
            {interests.map((row) => {
              const amount = formatInterestAmount(row.pledge_amount, row.interest_amount, row.pledge_currency);
              const date = row.updated_at ?? row.created_at;

              return (
                <div key={row.id} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">{investorCompanyLabel(row)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.status ?? "interested"}
                    {date ? ` · ${formatDate(date)}` : ""}
                  </p>
                  {amount ? <p className="mt-1 workspace-accent-text text-xs">{amount}</p> : null}
                  {row.message ? <p className="mt-2 text-slate-600">{row.message}</p> : null}
                </div>
              );
            })}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Intro requests" subtitle={`${introRequests.length} intro requests`}>
          <div className="divide-y divide-slate-100">
            {introRequests.map((row) => (
              <div key={row.id} className="py-3 text-sm">
                <p className="font-medium text-slate-900">{investorCompanyLabel(row)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.status ?? "requested"}
                  {row.created_at ? ` · ${formatDate(row.created_at)}` : ""}
                </p>
                {row.message ? <p className="mt-2 text-slate-600">{row.message}</p> : null}
              </div>
            ))}
          </div>
        </WorkspacePanel>
      </section>

      <section className="mt-8">
        <InvestorActivityTimeline activities={crmActivity.rows} error={crmActivity.error} />
      </section>
    </AppShell>
  );
}
