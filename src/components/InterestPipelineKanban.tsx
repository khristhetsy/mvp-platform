"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import type { InvestorInterestRecord, InvestorIntroRecord, InvestorSavedDealRecord } from "@/lib/data/investor-interests";

type ViewMode = "kanban" | "grid" | "list";

type PipelineCard = {
  id: string;
  company: string;
  companyId: string | null;
  slug: string | null;
  column: "watching" | "interested" | "intro" | "pledged";
  status: string;
  introStatus: "requested" | "reviewing" | "facilitated" | "declined" | null;
  date: string;
  amount: string | null;
  message: string | null;
};

const INTRO_STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  requested:   { badge: "bg-blue-50 text-blue-700",    label: "Pending review" },
  reviewing:   { badge: "bg-indigo-50 text-indigo-700", label: "Under review" },
  facilitated: { badge: "bg-emerald-50 text-emerald-800", label: "Facilitated ✓" },
  declined:    { badge: "bg-red-50 text-red-700",       label: "Not matched" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAmount(pledge: number | null, interest: number | null, currency: string | null) {
  if (pledge && pledge > 0) return `Pledged ${formatPledgeTotal(pledge, currency ?? "USD")}`;
  if (interest && interest > 0) return `Indicative ${formatPledgeTotal(interest, currency ?? "USD")}`;
  return null;
}

const COLUMNS: { key: PipelineCard["column"]; label: string; color: string; dot: string }[] = [
  { key: "watching", label: "Watching", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { key: "interested", label: "Interested", color: "bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  { key: "intro", label: "Intro requested", color: "bg-blue-50 text-blue-800", dot: "bg-blue-400" },
  { key: "pledged", label: "Pledged", color: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
];

export function InterestPipelineKanban({
  interests,
  introRequests,
  savedDeals,
}: Readonly<{
  interests: InvestorInterestRecord[];
  introRequests: InvestorIntroRecord[];
  savedDeals: InvestorSavedDealRecord[];
}>) {
  const [view, setView] = useState<ViewMode>("kanban");

  const cards = useMemo<PipelineCard[]>(() => {
    const result: PipelineCard[] = [];

    for (const row of savedDeals) {
      result.push({
        id: `saved-${row.id}`,
        company: row.companies?.company_name ?? "Unknown company",
        companyId: row.company_id ?? null,
        slug: row.companies?.slug ?? null,
        column: "watching",
        status: "saved",
        introStatus: null,
        date: row.updated_at ?? row.created_at,
        amount: null,
        message: null,
      });
    }

    for (const row of interests) {
      const amount = formatAmount(row.pledge_amount, row.interest_amount, row.pledge_currency);
      result.push({
        id: `interest-${row.id}`,
        company: row.companies?.company_name ?? "Unknown company",
        companyId: row.company_id ?? null,
        slug: row.companies?.slug ?? null,
        column: amount ? "pledged" : "interested",
        status: row.status ?? "interested",
        introStatus: null,
        date: row.updated_at ?? row.created_at,
        amount,
        message: row.message,
      });
    }

    for (const row of introRequests) {
      const s = row.status as "requested" | "reviewing" | "facilitated" | "declined" | null;
      result.push({
        id: `intro-${row.id}`,
        company: row.companies?.company_name ?? "Unknown company",
        companyId: row.company_id ?? null,
        slug: row.companies?.slug ?? null,
        column: "intro",
        status: row.status ?? "requested",
        introStatus: s,
        date: row.created_at,
        amount: null,
        message: row.message,
      });
    }

    return result;
  }, [interests, introRequests, savedDeals]);

  const byColumn = useMemo(() => {
    const map: Record<string, PipelineCard[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const card of cards) map[card.column]?.push(card);
    return map;
  }, [cards]);

  const totalAmount = useMemo(() => {
    let total = 0;
    for (const row of interests) {
      if (row.pledge_amount && row.pledge_amount > 0) total += Number(row.pledge_amount);
    }
    return total > 0 ? formatPledgeTotal(total, "USD") : null;
  }, [interests]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {totalAmount ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Total pledged: {totalAmount}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {cards.length} total
          </span>
        </div>

        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["kanban", "grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "kanban" ? "⊞ Kanban" : v === "grid" ? "⊟ Grid" : "≡ List"}
            </button>
          ))}
        </div>
      </div>

      {view === "kanban" && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
                    colCards.map((card) => {
                      const introStyle = card.introStatus
                        ? (INTRO_STATUS_STYLES[card.introStatus] ?? INTRO_STATUS_STYLES.requested)
                        : null;
                      return (
                        <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-1.5">
                            {card.companyId ? (
                              <Link
                                href={`/investor/opportunities/${card.companyId}/report`}
                                className="text-sm font-medium text-slate-900 hover:text-indigo-700 transition-colors leading-snug"
                              >
                                {card.company}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium text-slate-900 leading-snug">{card.company}</p>
                            )}
                            {card.companyId && (
                              <Link
                                href={`/investor/opportunities/${card.companyId}/report`}
                                className="shrink-0 text-[10px] text-slate-400 hover:text-indigo-600 transition-colors"
                                aria-label="View report"
                              >
                                →
                              </Link>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">{formatDate(card.date)}</p>
                          {card.amount ? (
                            <p className="mt-1.5 text-xs font-semibold text-indigo-700">{card.amount}</p>
                          ) : null}
                          {card.message ? (
                            <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600">{card.message}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {introStyle ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${introStyle.badge}`}>
                                {introStyle.label}
                              </span>
                            ) : (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                                {card.status}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.length === 0 ? (
            <p className="text-sm text-slate-500">No pipeline activity yet.</p>
          ) : (
            cards.map((card) => {
              const col = COLUMNS.find((c) => c.key === card.column)!;
              const introStyle = card.introStatus
                ? (INTRO_STATUS_STYLES[card.introStatus] ?? INTRO_STATUS_STYLES.requested)
                : null;
              return (
                <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    {card.companyId ? (
                      <Link
                        href={`/investor/opportunities/${card.companyId}/report`}
                        className="font-medium text-slate-900 hover:text-indigo-700 transition-colors"
                      >
                        {card.company}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{card.company}</p>
                    )}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                      {col.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(card.date)}</p>
                  {card.amount ? <p className="mt-2 text-xs font-semibold text-indigo-700">{card.amount}</p> : null}
                  {card.message ? <p className="mt-2 text-xs text-slate-600 line-clamp-2">{card.message}</p> : null}
                  {introStyle && (
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${introStyle.badge}`}>
                      {introStyle.label}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {view === "list" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {cards.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No pipeline activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {cards.map((card) => {
                const col = COLUMNS.find((c) => c.key === card.column)!;
                const introStyle = card.introStatus
                  ? (INTRO_STATUS_STYLES[card.introStatus] ?? INTRO_STATUS_STYLES.requested)
                  : null;
                return (
                  <div key={card.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${col.dot}`} />
                    {card.companyId ? (
                      <Link
                        href={`/investor/opportunities/${card.companyId}/report`}
                        className="flex-1 text-sm font-medium text-slate-900 hover:text-indigo-700 transition-colors"
                      >
                        {card.company}
                      </Link>
                    ) : (
                      <p className="flex-1 text-sm font-medium text-slate-900">{card.company}</p>
                    )}
                    {introStyle ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${introStyle.badge}`}>
                        {introStyle.label}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                        {col.label}
                      </span>
                    )}
                    {card.amount ? (
                      <span className="text-xs font-semibold text-indigo-700">{card.amount}</span>
                    ) : null}
                    <span className="text-[11px] text-slate-400">{formatDate(card.date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
