import { AppShell } from "@/components/AppShell";
import {
  InvestorWorkspaceDebugBox,
  InvestorWorkspaceRawDiagnosticLists,
  loadInvestorWorkspacePageDataForDebug,
} from "@/components/InvestorWorkspaceDebugBox";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import { investorCompanyLabel } from "@/lib/data/investor-workspace-page";
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

  return "Expressed interest";
}

export default async function InvestorPortfolioPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { data, loadError } = await loadInvestorWorkspacePageDataForDebug(investorId);
  const { workspace, crmActivity } = data;

  const pendingInterests = workspace.interests.filter(
    (row) =>
      (row.pledge_amount != null && Number(row.pledge_amount) > 0) ||
      (row.interest_amount != null && Number(row.interest_amount) > 0) ||
      row.status === "interested",
  );

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <InvestorWorkspaceDebugBox
        route="/investor/portfolio"
        authUserId={investorId}
        profileId={profile.id}
        profileRole={String(profile.role)}
        workspace={workspace}
        crmActivity={crmActivity}
        error={loadError}
      />
      <InvestorWorkspaceRawDiagnosticLists workspace={workspace} crmActivity={crmActivity} />
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
        <WorkspacePanel
          title="Pending / Indicative"
          subtitle={`${pendingInterests.length} non-completed interest records`}
        >
          {pendingInterests.length === 0 ? (
            <p className="text-sm text-slate-500">No pending or indicative interest records yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingInterests.map((row) => {
                const date = row.updated_at ?? row.created_at;

                return (
                  <div key={row.id} className="py-3 text-sm">
                    <p className="font-medium text-slate-900">{investorCompanyLabel(row)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatPendingLabel(row.pledge_amount, row.interest_amount, row.pledge_currency)}
                    </p>
                    {date ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Updated {new Date(date).toLocaleDateString("en-US", { timeZone: "UTC" })}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </WorkspacePanel>
      </section>
    </AppShell>
  );
}
