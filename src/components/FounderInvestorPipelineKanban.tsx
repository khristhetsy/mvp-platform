"use client";

import { useMemo, useState } from "react";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import type {
  FounderInvestorActivityResult,
  FounderInvestorInterestRecord,
  FounderInvestorIntroRecord,
  FounderInvestorSavedRecord,
} from "@/lib/data/investor-interests";

type ViewMode = "kanban" | "grid" | "list";

type PipelineCard = {
  id: string;
  investorName: string;
  investorEmail: string | null;
  column: "watching" | "interested" | "intro" | "pledged";
  detail: string;
  amount: string | null;
  date: string;
};

const COLUMNS: { key: PipelineCard["column"]; label: string; color: string; dot: string }[] = [
  { key: "watching", label: "Watching", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { key: "interested", label: "Interested", color: "bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  { key: "intro", label: "Intro Requested", color: "bg-blue-50 text-blue-800", dot: "bg-blue-400" },
  { key: "pledged", label: "Pledged", color: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
];

function resolveProfile(profiles: unknown): { name: string; email: string | null } {
  if (!profiles) return { name: "Investor", email: null };
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return {
    name: (p as { full_name?: string | null })?.full_name ?? (p as { email?: string | null })?.email ?? "Investor",
    email: (p as { email?: string | null })?.email ?? null,
  };
}

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

export function FounderInvestorPipelineKanban({
  activity,
}: Readonly<{ activity: FounderInvestorActivityResult }>) {
  const [view, setView] = useState<ViewMode>("kanban");

  const cards = useMemo<PipelineCard[]>(() => {
    const result: PipelineCard[] = [];

    for (const row of activity.savedDeals as FounderInvestorSavedRecord[]) {
      const { name, email } = resolveProfile(row.profiles);
      result.push({
        id: `saved-${row.id}`,
        investorName: name,
        investorEmail: email,
        column: "watching",
        detail: row.status ?? "Saved",
        amount: null,
        date: row.updated_at ?? row.created_at,
      });
    }

    for (const row of activity.interests as FounderInvestorInterestRecord[]) {
      const { name, email } = resolveProfile(row.profiles);
      const amount = formatAmount(row.pledge_amount, row.interest_amount, row.pledge_currency);
      result.push({
        id: `interest-${row.id}`,
        investorName: name,
        investorEmail: email,
        column: amount ? "pledged" : "interested",
        detail: row.status ?? "interested",
        amount,
        date: row.updated_at ?? row.created_at,
      });
    }

    for (const row of activity.introRequests as FounderInvestorIntroRecord[]) {
      const { name, email } = resolveProfile(row.profiles);
      result.push({
        id: `intro-${row.id}`,
        investorName: name,
        investorEmail: email,
        column: "intro",
        detail: row.status ?? "requested",
        amount: null,
        date: row.created_at,
      });
    }

    return result;
  }, [activity]);

  const byColumn = useMemo(() => {
    const map: Record<string, PipelineCard[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const card of cards) map[card.column]?.push(card);
    return map;
  }, [cards]);

  const totalPledged = useMemo(() => {
    let total = 0;
    for (const row of activity.interests as FounderInvestorInterestRecord[]) {
      if (row.pledge_amount && row.pledge_amount > 0) total += Number(row.pledge_amount);
    }
    return total > 0 ? formatPledgeTotal(total, "USD") : null;
  }, [activity.interests]);

  if (cards.length === 0) {
    return (
      <p className="text-sm text-amber-900">
        No investor activity yet. Inbound interest will appear here when registered investors engage with your listing.
      </p>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {totalPledged ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Total pledged: {totalPledged}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {cards.length} investor{cards.length !== 1 ? "s" : ""}
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

      {/* Kanban */}
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
                    colCards.map((card) => (
                      <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-sm font-medium text-slate-900">{card.investorName}</p>
                        {card.investorEmail ? (
                          <p className="text-[11px] text-slate-400">{card.investorEmail}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-slate-500">{formatDate(card.date)}</p>
                        {card.amount ? (
                          <p className="mt-1 text-xs font-semibold text-indigo-700">{card.amount}</p>
                        ) : null}
                        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                          {card.detail}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const col = COLUMNS.find((c) => c.key === card.column)!;
            return (
              <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-medium text-slate-900">{card.investorName}</p>
                {card.investorEmail ? (
                  <p className="text-xs text-slate-400">{card.investorEmail}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">{formatDate(card.date)}</p>
                {card.amount ? (
                  <p className="mt-2 text-xs font-semibold text-indigo-700">{card.amount}</p>
                ) : null}
                <span className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                  {col.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {view === "list" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {cards.map((card) => {
              const col = COLUMNS.find((c) => c.key === card.column)!;
              return (
                <div key={card.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${col.dot}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{card.investorName}</p>
                    {card.investorEmail ? (
                      <p className="text-[11px] text-slate-400">{card.investorEmail}</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                    {col.label}
                  </span>
                  {card.amount ? (
                    <span className="text-xs font-semibold text-indigo-700">{card.amount}</span>
                  ) : null}
                  <span className="text-[11px] text-slate-400">{formatDate(card.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
