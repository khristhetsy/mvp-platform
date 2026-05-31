"use client";

import Link from "next/link";
import { getCompanyWorkspaceHref, getInvestorWorkspaceHref } from "@/lib/ui/drilldown-links";

function formatActivityRow(row: {
  id: string;
  investor_id?: string;
  company_id?: string;
  status?: string | null;
  created_at?: string;
  profiles?: { id?: string; full_name?: string | null; email?: string | null } | null;
  companies?: { company_name?: string | null; slug?: string | null } | null;
  pledge_amount?: number | null;
  pledge_currency?: string | null;
  message?: string | null;
}) {
  const investor = row.profiles?.full_name ?? row.profiles?.email ?? "Unknown investor";
  const company = row.companies?.company_name ?? "Unknown company";
  const date = row.created_at
    ? new Date(row.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })
    : "—";
  const investorId = row.investor_id ?? row.profiles?.id ?? null;
  const companyId = row.company_id ?? null;

  return {
    id: row.id,
    investor,
    company,
    status: row.status ?? "—",
    date,
    message: row.message ?? null,
    investorId,
    companyId,
  };
}

type Props = {
  interests: Array<Record<string, unknown>>;
  introRequests: Array<Record<string, unknown>>;
  savedDeals: Array<Record<string, unknown>>;
};

export function AdminInvestorActivity({ interests, introRequests, savedDeals }: Props) {
  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-3">
      {[
        ["Investor Interests", interests],
        ["Intro Requests", introRequests],
        ["Saved Deals", savedDeals],
      ].map(([title, rows]) => (
        <div key={title as string} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">{title as string}</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {(rows as Props["interests"]).length === 0 ? (
              <p className="py-3 text-sm text-slate-500">No activity yet.</p>
            ) : (
              (rows as Props["interests"]).map((raw) => {
                const row = formatActivityRow(raw as Parameters<typeof formatActivityRow>[0]);
                return (
                  <div key={row.id} className="py-3 text-sm">
                    {row.investorId ? (
                      <Link href={getInvestorWorkspaceHref(row.investorId)} className="font-medium text-indigo-700 hover:text-indigo-900">
                        {row.investor}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{row.investor}</p>
                    )}
                    {row.companyId ? (
                      <Link href={getCompanyWorkspaceHref(row.companyId)} className="text-indigo-600 hover:text-indigo-800">
                        {row.company}
                      </Link>
                    ) : (
                      <p className="text-slate-600">{row.company}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {row.status} · {row.date}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
