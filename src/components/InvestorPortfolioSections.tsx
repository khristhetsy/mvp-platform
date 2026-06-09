import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { CompanyUpdateRecord } from "@/lib/company-updates/types";
import type { InvestorPortfolioSnapshot, PortfolioCompanyRow } from "@/lib/investor/load-portfolio";

function CompanyRows({ rows, emptyLabel }: { rows: PortfolioCompanyRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={`${row.companyId}-${row.detail}`} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
          <div>
            <p className="font-medium text-slate-900">{row.companyName}</p>
            <p className="mt-1 text-xs text-slate-500">{row.detail}</p>
            {row.date ? (
              <p className="mt-1 text-xs text-slate-500">
                {new Date(row.date).toLocaleDateString("en-US", { timeZone: "UTC" })}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {row.companyId ? (
              <Link
                href={`/investor/opportunities/${row.companyId}/report`}
                className="text-xs font-semibold text-indigo-700"
              >
                View report
              </Link>
            ) : null}
            {row.slug ? (
              <Link href={`/deals/${row.slug}`} className="text-xs font-semibold text-slate-600">
                Listing
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function UpdateFeed({ updates }: { updates: CompanyUpdateRecord[] }) {
  if (updates.length === 0) {
    return <p className="text-sm text-slate-500">No company updates from your network yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {updates.map((update) => {
        const company = Array.isArray(update.companies) ? update.companies[0] : update.companies;
        const companyName = company?.company_name ?? "Company";
        const companyId = update.company_id;

        return (
          <article key={update.id} className="py-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{update.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {companyName} · {update.update_type} ·{" "}
                  {update.published_at
                    ? new Date(update.published_at).toLocaleDateString()
                    : "Draft"}
                </p>
              </div>
              {companyId ? (
                <Link
                  href={`/investor/opportunities/${companyId}/report`}
                  className="text-xs font-semibold text-indigo-700"
                >
                  View report
                </Link>
              ) : null}
            </div>
            <p className="mt-2 leading-6 text-slate-600">{update.body}</p>
          </article>
        );
      })}
    </div>
  );
}

export function InvestorPortfolioSections({ portfolio }: { portfolio: InvestorPortfolioSnapshot }) {
  return (
    <div className="space-y-6">
      <WorkspacePanel title="Completed investments" subtitle="Legal holdings — not tracked in Phase 1">
        <p className="text-sm text-slate-600">No completed investments yet. This workspace tracks indicative relationships only.</p>
      </WorkspacePanel>

      <WorkspacePanel
        title="Pending / Indicative"
        subtitle={`${portfolio.pendingCommitments.length} indicative commitment(s)`}
      >
        <CompanyRows rows={portfolio.pendingCommitments} emptyLabel="No pending or indicative commitments yet." />
      </WorkspacePanel>

      <WorkspacePanel
        title="Interested companies"
        subtitle={`${portfolio.interestedCompanies.length} expressed interest record(s)`}
      >
        <CompanyRows rows={portfolio.interestedCompanies} emptyLabel="No expressed interest yet." />
      </WorkspacePanel>

      <WorkspacePanel
        title="Intro requests"
        subtitle={`${portfolio.introCompanies.length} company(ies)`}
      >
        <CompanyRows rows={portfolio.introCompanies} emptyLabel="No intro requests yet." />
      </WorkspacePanel>

      <WorkspacePanel title="Meetings" subtitle="Scheduled meetings via CapitalOS messaging">
        {portfolio.meetingCompanies.length === 0 ? (
          <p className="text-sm text-slate-500">No scheduled meetings yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {portfolio.meetingCompanies.map((row) => (
              <div key={row.companyId} className="py-3 text-sm">
                <p className="font-medium text-slate-900">{row.companyName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.scheduledCount} scheduled
                  {row.lastMeetingAt
                    ? ` · next ${new Date(row.lastMeetingAt).toLocaleDateString()}`
                    : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/investor/opportunities/${row.companyId}/report`}
                    className="text-xs font-semibold text-indigo-700"
                  >
                    View report
                  </Link>
                  {row.slug ? (
                    <Link href={`/deals/${row.slug}`} className="text-xs font-semibold text-slate-600">
                      Listing
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>

      <WorkspacePanel title="Watchlist" subtitle={`${portfolio.watchlist.length} saved deal(s)`}>
        <CompanyRows rows={portfolio.watchlist} emptyLabel="No saved deals on your watchlist." />
      </WorkspacePanel>

      <WorkspacePanel title="Company updates" subtitle="Updates from companies in your network">
        <UpdateFeed updates={portfolio.companyUpdates} />
      </WorkspacePanel>
    </div>
  );
}
