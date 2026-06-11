"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CompanyUpdateRecord } from "@/lib/company-updates/types";
import type { InvestorPortfolioSnapshot } from "@/lib/investor/load-portfolio";

type PortfolioCard = {
  id: string;
  company: string;
  companyId: string;
  slug: string | null;
  column: "watchlist" | "interested" | "intro" | "meeting" | "committed";
  detail: string;
  date: string | null;
};

const COLUMNS: {
  key: PortfolioCard["column"];
  label: string;
  color: string;
  dot: string;
}[] = [
  { key: "watchlist", label: "Watchlist", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { key: "interested", label: "Interested", color: "bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  { key: "intro", label: "Intro Requested", color: "bg-blue-50 text-blue-800", dot: "bg-blue-400" },
  { key: "meeting", label: "Meetings", color: "bg-violet-50 text-violet-800", dot: "bg-violet-400" },
  { key: "committed", label: "Committed", color: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
];

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function CardLinks({ companyId, slug }: { companyId: string; slug: string | null }) {
  return (
    <div className="mt-2 flex gap-3">
      <Link href={`/investor/opportunities/${companyId}/report`} className="text-[11px] font-semibold text-indigo-700 hover:underline">
        View report
      </Link>
      {slug ? (
        <Link href={`/deals/${slug}`} className="text-[11px] font-semibold text-slate-500 hover:underline">
          Listing
        </Link>
      ) : null}
    </div>
  );
}

function UpdateFeed({ updates }: { updates: CompanyUpdateRecord[] }) {
  if (updates.length === 0) {
    return <p className="text-sm text-slate-500">No company updates from your network yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {updates.map((update) => {
        const company = Array.isArray(update.companies) ? update.companies[0] : update.companies;
        const companyName = company?.company_name ?? "Company";

        return (
          <article key={update.id} className="px-4 py-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{update.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {companyName} · {update.update_type} ·{" "}
                  {update.published_at ? new Date(update.published_at).toLocaleDateString() : "Draft"}
                </p>
              </div>
              {update.company_id ? (
                <Link
                  href={`/investor/opportunities/${update.company_id}/report`}
                  className="text-xs font-semibold text-indigo-700 hover:underline"
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
  const cards = useMemo<PortfolioCard[]>(() => {
    const result: PortfolioCard[] = [];

    for (const row of portfolio.watchlist) {
      result.push({
        id: `watchlist-${row.companyId}`,
        company: row.companyName,
        companyId: row.companyId,
        slug: row.slug,
        column: "watchlist",
        detail: row.detail,
        date: row.date,
      });
    }

    for (const row of portfolio.interestedCompanies) {
      result.push({
        id: `interest-${row.companyId}`,
        company: row.companyName,
        companyId: row.companyId,
        slug: row.slug,
        column: "interested",
        detail: row.detail,
        date: row.date,
      });
    }

    for (const row of portfolio.introCompanies) {
      result.push({
        id: `intro-${row.companyId}`,
        company: row.companyName,
        companyId: row.companyId,
        slug: row.slug,
        column: "intro",
        detail: row.detail,
        date: row.date,
      });
    }

    for (const row of portfolio.meetingCompanies) {
      result.push({
        id: `meeting-${row.companyId}`,
        company: row.companyName,
        companyId: row.companyId,
        slug: row.slug,
        column: "meeting",
        detail: `${row.scheduledCount} scheduled meeting${row.scheduledCount !== 1 ? "s" : ""}`,
        date: row.lastMeetingAt,
      });
    }

    for (const row of portfolio.pendingCommitments) {
      result.push({
        id: `committed-${row.companyId}`,
        company: row.companyName,
        companyId: row.companyId,
        slug: row.slug,
        column: "committed",
        detail: row.detail,
        date: row.date,
      });
    }

    return result;
  }, [portfolio]);

  const byColumn = useMemo(() => {
    const map: Record<string, PortfolioCard[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const card of cards) map[card.column]?.push(card);
    return map;
  }, [cards]);

  const totalCards = cards.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {totalCards} relationship{totalCards !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Kanban view */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const colCards = byColumn[col.key] ?? [];
            return (
              <div key={col.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {colCards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colCards.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
                      None
                    </div>
                  ) : (
                    colCards.map((card) => (
                      <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-sm font-medium text-slate-900">{card.company}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{card.detail}</p>
                        {card.date ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(card.date)}</p>
                        ) : null}
                        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                          {col.label}
                        </span>
                        {card.companyId ? <CardLinks companyId={card.companyId} slug={card.slug} /> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

      {/* Company updates feed — always shown below */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Company updates</h2>
          <p className="text-xs text-slate-500">Updates from companies in your network</p>
        </div>
        <UpdateFeed updates={portfolio.companyUpdates} />
      </section>
    </div>
  );
}
