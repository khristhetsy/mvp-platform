"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { summarize, modelRound } from "@/lib/cap-table/compute";
import type { CapTable } from "@/lib/cap-table/types";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}

export function CompanyCapTablePanel({ companyId }: { companyId: string }) {
  const t = useTranslations("adminCmp");
  const [capTable, setCapTable] = useState<CapTable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch(`/api/admin/companies/${companyId}/cap-table`)
      .then((r) => r.json())
      .then((j) => on && setCapTable((j.capTable as CapTable) ?? null))
      .catch(() => {})
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [companyId]);

  const sum = useMemo(() => (capTable ? summarize(capTable.holders) : null), [capTable]);
  const dilution = useMemo(
    () => (capTable?.round ? modelRound(capTable.holders, capTable.round) : null),
    [capTable],
  );

  if (loading) return <p className="text-sm text-slate-500">{t("loading")}</p>;
  if (!capTable || !sum || capTable.holders.length === 0) return <p className="text-sm text-slate-500">{t("no_cap_table_started_yet")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">Founders {pct(sum.founderPct)}</span>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-medium text-teal-700">Pool {pct(sum.poolPct)}</span>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">Investors {pct(sum.investorPct)}</span>
        <span className="text-slate-500">{sum.totalShares.toLocaleString()} shares · updated {capTable.updatedAt ? new Date(capTable.updatedAt).toLocaleDateString() : "—"}</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("shareholders")}</p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="py-1">Holder</th><th>Class</th><th className="text-right">Shares</th><th className="text-right">FD %</th>
            </tr>
          </thead>
          <tbody>
            {sum.rows.map((row) => (
              <tr key={row.holder.id} className="border-t border-slate-100">
                <td className="py-1 text-slate-700">{row.holder.name}</td>
                <td className="py-1 text-slate-500">{row.holder.shareClass}</td>
                <td className="py-1 text-right tabular-nums">{Math.max(0, row.holder.shares).toLocaleString()}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dilution && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modeled_round")}</p>
          <p className="mt-2 text-sm text-slate-600">
            Pre {money(dilution.preMoney)} + new {money(dilution.newInvestment)} = post {money(dilution.postMoney)} · new investor {pct(dilution.newInvestorPct)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dilution.rows.map((d) => (
              <span key={d.name + d.group} className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                {d.name}: {pct(d.pctBefore)} → {pct(d.pctAfter)}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Founder-entered figures. Illustrative cap table and dilution — not a valuation, an offer of securities, or investment advice.
      </p>
    </div>
  );
}
