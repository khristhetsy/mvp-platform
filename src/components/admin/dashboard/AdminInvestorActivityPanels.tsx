import { EmptyState } from "@/components/ui/EmptyState";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import type { AdminInvestorActivityData } from "@/components/admin/dashboard/types";

type ActivityRow = {
  id: string;
  investor: string;
  company: string;
  status: string;
  date: string;
  amount: string | null;
  message: string | null;
};

function formatActivityRow(raw: Record<string, unknown>): ActivityRow {
  const profiles = raw.profiles as { full_name?: string | null; email?: string | null } | null | undefined;
  const companies = raw.companies as { company_name?: string | null } | null | undefined;
  const investor = profiles?.full_name ?? profiles?.email ?? "Unknown investor";
  const company = companies?.company_name ?? "Unknown company";
  const createdAt = typeof raw.created_at === "string" ? raw.created_at : null;
  const date = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "—";
  const pledgeAmount = typeof raw.pledge_amount === "number" ? raw.pledge_amount : null;
  const pledgeCurrency = typeof raw.pledge_currency === "string" ? raw.pledge_currency : "USD";
  const amount = pledgeAmount != null ? formatPledgeTotal(pledgeAmount, pledgeCurrency) : null;

  return {
    id: String(raw.id),
    investor,
    company,
    status: typeof raw.status === "string" ? raw.status : "—",
    date,
    amount,
    message: typeof raw.message === "string" ? raw.message : null,
  };
}

function ActivityPanel({
  title,
  rows,
  emptyTitle,
  emptyDescription,
}: Readonly<{
  title: string;
  rows: ActivityRow[];
  emptyTitle: string;
  emptyDescription: string;
}>) {
  return (
    <WorkspacePanel title={title} subtitle={`${rows.length} loaded · most recent first`}>
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.slice(0, 8).map((row) => (
            <li key={row.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <div className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-[var(--navy)]/20" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{row.investor}</p>
                  <time className="shrink-0 font-mono text-[10px] text-slate-400">{row.date}</time>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-600">{row.company}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium capitalize">{row.status}</span>
                  {row.amount ? <span className="font-mono text-slate-700">{row.amount}</span> : null}
                </div>
                {row.message ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{row.message}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );
}

export function AdminInvestorActivityPanels({
  investorActivity,
}: Readonly<{ investorActivity: AdminInvestorActivityData }>) {
  const interests = investorActivity.interests.map((raw) => formatActivityRow(raw));
  const introRequests = investorActivity.introRequests.map((raw) => formatActivityRow(raw));
  const savedDeals = investorActivity.savedDeals.map((raw) => formatActivityRow(raw));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ActivityPanel
        title="Investor Interests"
        rows={interests}
        emptyTitle="No investor interests"
        emptyDescription="Expressed interest will appear here as investors engage with marketplace listings."
      />
      <ActivityPanel
        title="Intro Requests"
        rows={introRequests}
        emptyTitle="No intro requests"
        emptyDescription="Introduction requests from investors will surface in this panel."
      />
      <ActivityPanel
        title="Saved Deals"
        rows={savedDeals}
        emptyTitle="No saved deals"
        emptyDescription="Investor watchlist activity will appear here when deals are saved."
      />
    </div>
  );
}
