import { AppShell } from "@/components/AppShell";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
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

function isFollowUpIntroMessage(message: string | null | undefined) {
  if (!message) {
    return false;
  }

  return /follow[\s-]?up|capitalos platform/i.test(message);
}

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
  const { data, loadError } = await loadInvestorWorkspacePageDataForDebug(investorId, 20);
  const { workspace, crmActivity } = data;

  const interests = workspace.interests;
  const introRequests = workspace.introRequests.filter((row) => !isFollowUpIntroMessage(row.message));
  const followUpRequests = workspace.introRequests.filter((row) => isFollowUpIntroMessage(row.message));

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <InvestorWorkspaceDebugBox
        route="/investor/interest-pipeline"
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Interest Pipeline</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track expressed interest, pledge amounts, intro requests, and follow-ups across marketplace listings.
        </p>
      </div>

      {interests.length === 0 && introRequests.length === 0 && followUpRequests.length === 0 ? (
        <WorkspacePanel title="Interest pipeline" subtitle="Your marketplace activity">
          <p className="text-sm text-slate-600">No interest records yet.</p>
        </WorkspacePanel>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-2">
            <WorkspacePanel title="Expressed interest" subtitle={`${interests.length} interest records`}>
              {interests.length === 0 ? (
                <p className="text-sm text-slate-500">No expressed interest yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {interests.map((row) => {
                    const amount = formatInterestAmount(
                      row.pledge_amount,
                      row.interest_amount,
                      row.pledge_currency,
                    );
                    const date = row.updated_at ?? row.created_at;

                    return (
                      <div key={row.id} className="py-3 text-sm">
                        <p className="font-medium text-slate-900">{investorCompanyLabel(row)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.status ?? "interested"}
                          {date ? ` · ${formatDate(date)}` : ""}
                        </p>
                        {amount ? <p className="mt-1 text-xs font-medium text-indigo-700">{amount}</p> : null}
                        {row.message ? <p className="mt-2 text-slate-600">{row.message}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </WorkspacePanel>

            <WorkspacePanel title="Intro requests" subtitle={`${introRequests.length} intro requests`}>
              {introRequests.length === 0 ? (
                <p className="text-sm text-slate-500">No intro requests yet.</p>
              ) : (
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
              )}
            </WorkspacePanel>

            <WorkspacePanel title="Follow-up requests" subtitle={`${followUpRequests.length} follow-ups`}>
              {followUpRequests.length === 0 ? (
                <p className="text-sm text-slate-500">No follow-up requests yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {followUpRequests.map((row) => (
                    <div key={row.id} className="py-3 text-sm">
                      <p className="font-medium text-slate-900">{investorCompanyLabel(row)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Follow-up · {row.created_at ? formatDate(row.created_at) : "—"}
                      </p>
                      {row.message ? <p className="mt-2 text-slate-600">{row.message}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </WorkspacePanel>
          </section>

          <section className="mt-8">
            <InvestorActivityTimeline activities={crmActivity.rows} error={crmActivity.error} />
          </section>
        </>
      )}
    </AppShell>
  );
}
