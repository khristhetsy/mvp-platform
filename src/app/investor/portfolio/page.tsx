import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function formatPendingLabel(
  pledgeAmount: number | null,
  interestAmount: number | null,
  pledgeCurrency: string | null,
) {
  if (pledgeAmount != null && Number(pledgeAmount) > 0) {
    return `Pending pledge · ${formatPledgeTotal(Number(pledgeAmount), pledgeCurrency ?? "USD")}`;
  }

  if (interestAmount != null && Number(interestAmount) > 0) {
    return `Indicative interest · ${formatPledgeTotal(Number(interestAmount), pledgeCurrency ?? "USD")}`;
  }

  return rowStatusLabel(pledgeAmount, interestAmount);
}

function rowStatusLabel(pledgeAmount: number | null, interestAmount: number | null) {
  if (pledgeAmount != null) {
    return `Pledge amount · ${pledgeAmount}`;
  }

  if (interestAmount != null) {
    return `Indicative amount · ${interestAmount}`;
  }

  return "Expressed interest";
}

export default async function InvestorPortfolioPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace } = await loadInvestorWorkspacePageData(investorId);

  const interests = workspace.interests;

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Portfolio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Completed investments and pending indicative interest from your marketplace activity.
        </p>
      </div>

      <WorkspacePanel title="Completed investments" subtitle="Portfolio holdings">
        <p className="text-sm leading-6 text-slate-600">
          Portfolio holdings will appear here after completed investments.
        </p>
      </WorkspacePanel>

      <section className="mt-6">
        <WorkspacePanel title="Pending / Indicative" subtitle={`${interests.length} interest records`}>
          <div className="divide-y divide-slate-100">
            {interests.map((row) => {
              const date = row.updated_at ?? row.created_at;

              return (
                <div key={row.id} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">{investorCompanyLabel(row)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.status ?? "interested"}
                    {date ? ` · ${new Date(date).toLocaleDateString("en-US", { timeZone: "UTC" })}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-medium text-indigo-700">
                    {formatPendingLabel(row.pledge_amount, row.interest_amount, row.pledge_currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </WorkspacePanel>
      </section>
    </AppShell>
  );
}
