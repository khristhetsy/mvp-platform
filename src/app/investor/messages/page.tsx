import { AppShell } from "@/components/AppShell";
import {
  InvestorWorkspaceDebugBox,
  InvestorWorkspaceRawDiagnosticLists,
  loadInvestorWorkspacePageDataForDebug,
} from "@/components/InvestorWorkspaceDebugBox";
import { WorkspacePanel } from "@/components/WorkspacePanel";
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
  const { data, loadError } = await loadInvestorWorkspacePageDataForDebug(investorId, 20);
  const { workspace, crmActivity } = data;

  const introRecords = workspace.introRequests.map((row) => ({
    id: `intro:${row.id}`,
    companyName: investorCompanyLabel(row),
    type: isFollowUpIntroMessage(row.message) ? "Follow-up request" : "Intro request",
    message: row.message ?? null,
    createdAt: row.created_at,
  }));

  const activityRecords = crmActivity.rows.map((row) => ({
    id: `activity:${row.id}`,
    companyName: row.company_name ?? "Unknown company",
    type: formatActivityLabel(row.activity_type),
    message: null as string | null,
    createdAt: row.created_at,
  }));

  const communicationRecords = [...introRecords, ...activityRecords].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <InvestorWorkspaceDebugBox
        route="/investor/messages"
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Messages</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Communication activity from intro requests, follow-ups, and platform interactions.
        </p>
      </div>

      <WorkspacePanel
        title="Communication activity"
        subtitle={
          communicationRecords.length > 0
            ? `${communicationRecords.length} activity records`
            : "No messaging backend yet"
        }
      >
        {crmActivity.error ? (
          <p className="mb-3 text-sm text-red-700">CRM activity error: {crmActivity.error}</p>
        ) : null}
        {communicationRecords.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            Messages will appear here when founder or platform communications are available.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {communicationRecords.map((record) => (
              <div key={record.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                    {record.type}
                  </span>
                  <span className="text-xs text-slate-500">{formatDate(record.createdAt)}</span>
                </div>
                <p className="mt-2 font-medium text-slate-900">{record.companyName}</p>
                {record.message ? <p className="mt-2 text-slate-600">{record.message}</p> : null}
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>
    </AppShell>
  );
}
