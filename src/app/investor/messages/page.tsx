import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatActivityLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function InvestorMessagesPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace, crmActivity } = await loadInvestorWorkspacePageData(investorId, 20);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Messages</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Communication activity from intro requests, follow-ups, and platform interactions.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Intro requests" subtitle={`${workspace.introRequests.length} records`}>
          <div className="divide-y divide-slate-100">
            {workspace.introRequests.map((row) => (
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

        <WorkspacePanel title="CRM activity" subtitle={`${crmActivity.rows.length} records`}>
          {crmActivity.error ? (
            <p className="mb-3 text-sm text-red-700">CRM activity error: {crmActivity.error}</p>
          ) : null}
          <div className="divide-y divide-slate-100">
            {crmActivity.rows.map((row) => (
              <div key={row.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                    {formatActivityLabel(row.activity_type)}
                  </span>
                  <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>
                </div>
                <p className="mt-2 font-medium text-slate-900">{row.company_name ?? "Unknown company"}</p>
              </div>
            ))}
          </div>
        </WorkspacePanel>
      </section>
    </AppShell>
  );
}
