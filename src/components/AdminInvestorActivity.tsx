"use client";

import { useMemo } from "react";

type ActivityRow = {
  id: string;
  status?: string | null;
  created_at?: string;
  profiles?: { full_name?: string | null; email?: string | null } | null | Array<{ full_name?: string | null; email?: string | null }>;
  companies?: { company_name?: string | null; slug?: string | null } | null | Array<{ company_name?: string | null; slug?: string | null }>;
  pledge_amount?: number | null;
  pledge_currency?: string | null;
  message?: string | null;
};

type PipelineCard = {
  id: string;
  investor: string;
  investorEmail: string | null;
  company: string;
  column: "watching" | "interested" | "intro" | "pledged";
  status: string;
  date: string;
  amount: string | null;
  message: string | null;
};

const COLUMNS: { key: PipelineCard["column"]; label: string; color: string; dot: string }[] = [
  { key: "watching", label: "Watching", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { key: "interested", label: "Interested", color: "bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  { key: "intro", label: "Intro Requested", color: "bg-blue-50 text-blue-800", dot: "bg-blue-400" },
  { key: "pledged", label: "Pledged", color: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
];

function resolveProfile(profiles: ActivityRow["profiles"]): { name: string; email: string | null } {
  if (!profiles) return { name: "Unknown investor", email: null };
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return {
    name: p?.full_name ?? p?.email ?? "Unknown investor",
    email: p?.email ?? null,
  };
}

function resolveCompany(companies: ActivityRow["companies"]): string {
  if (!companies) return "Unknown company";
  const c = Array.isArray(companies) ? companies[0] : companies;
  return c?.company_name ?? "Unknown company";
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPledge(amount: number | null | undefined, currency: string | null | undefined) {
  if (!amount || amount <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  interests: Array<Record<string, unknown>>;
  introRequests: Array<Record<string, unknown>>;
  savedDeals: Array<Record<string, unknown>>;
};

export function AdminInvestorActivity({ interests, introRequests, savedDeals }: Props) {
  const cards = useMemo<PipelineCard[]>(() => {
    const result: PipelineCard[] = [];

    for (const raw of savedDeals) {
      const row = raw as ActivityRow;
      const { name, email } = resolveProfile(row.profiles);
      result.push({
        id: `saved-${row.id}`,
        investor: name,
        investorEmail: email,
        company: resolveCompany(row.companies),
        column: "watching",
        status: row.status ?? "saved",
        date: row.created_at ?? "",
        amount: null,
        message: null,
      });
    }

    for (const raw of interests) {
      const row = raw as ActivityRow;
      const { name, email } = resolveProfile(row.profiles);
      const amount = formatPledge(row.pledge_amount, row.pledge_currency);
      result.push({
        id: `interest-${row.id}`,
        investor: name,
        investorEmail: email,
        company: resolveCompany(row.companies),
        column: amount ? "pledged" : "interested",
        status: row.status ?? "interested",
        date: row.created_at ?? "",
        amount,
        message: row.message ?? null,
      });
    }

    for (const raw of introRequests) {
      const row = raw as ActivityRow;
      const { name, email } = resolveProfile(row.profiles);
      result.push({
        id: `intro-${row.id}`,
        investor: name,
        investorEmail: email,
        company: resolveCompany(row.companies),
        column: "intro",
        status: row.status ?? "requested",
        date: row.created_at ?? "",
        amount: null,
        message: row.message ?? null,
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

  const totalPledged = useMemo(() => {
    let total = 0;
    for (const raw of interests) {
      const row = raw as ActivityRow;
      if (row.pledge_amount && row.pledge_amount > 0) total += Number(row.pledge_amount);
    }
    if (total === 0) return null;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(total);
  }, [interests]);

  return (
    <section className="mt-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {totalPledged ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Total pledged: {totalPledged}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {cards.length} record{cards.length !== 1 ? "s" : ""}
          </span>
        </div>

      </div>

      {/* Kanban */}
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
                        <p className="text-sm font-medium text-slate-900">{card.investor}</p>
                        {card.investorEmail ? (
                          <p className="text-[11px] text-slate-400">{card.investorEmail}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-slate-600">{card.company}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatDate(card.date)}</p>
                        {card.amount ? (
                          <p className="mt-1 text-xs font-semibold text-indigo-700">{card.amount}</p>
                        ) : null}
                        {card.message ? (
                          <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600">{card.message}</p>
                        ) : null}
                        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.color}`}>
                          {card.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
    </section>
  );
}
