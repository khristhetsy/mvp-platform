import { LayoutGrid } from "lucide-react";
import type { FounderInvestorRow } from "@/lib/founder/private-market";

const SIGIL: Record<string, string> = {
  high: "bg-[var(--teal-muted)] text-[var(--teal)]",
  mid: "bg-[var(--blue-muted)] text-[var(--blue-hover)]",
  low: "bg-slate-100 text-slate-400",
};
const PRICE: Record<string, string> = {
  high: "text-[var(--teal)]",
  mid: "text-[var(--navy)]",
  low: "text-slate-600",
};
const BAND_LABEL: Record<string, string> = { high: "Strong", mid: "Moderate", low: "Building" };

export function FounderPrivateMarketBoard({ rows }: Readonly<{ rows: FounderInvestorRow[] }>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No approved investors to rank yet. As investors are approved on the platform, your best-fit matches will
        appear here, scored to your company.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--navy)]">Investors</h2>
            <p className="font-mono text-[11px] text-slate-400">{rows.length} ranked to your company · best fit first</p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-slate-400">Identities hidden</span>
      </div>

      <div className="hidden grid-cols-[1.7fr_0.9fr_1fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-400 sm:grid">
        <div>Investor</div>
        <div className="text-right">Your match</div>
        <div>Check size</div>
        <div>Sector focus</div>
      </div>

      <div>
        {rows.map((r) => (
          <div
            key={r.symbol}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] sm:grid-cols-[1.7fr_0.9fr_1fr_0.9fr]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold ${SIGIL[r.band]}`}>
                {r.symbol.replace("INV·", "").slice(0, 3)}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold text-[var(--navy)]">{r.symbol}</div>
                <div className="truncate text-[11.5px] text-slate-400">{r.label}</div>
              </div>
            </div>

            <div className="text-right">
              <div className={`font-mono text-[19px] font-semibold leading-none ${PRICE[r.band]}`}>
                {r.matchScore}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">{BAND_LABEL[r.band]}</div>
            </div>

            <div className="hidden font-mono text-[12.5px] font-semibold text-slate-700 sm:block">{r.checkSize}</div>

            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {r.sectors.length > 0 ? (
                r.sectors.map((t) => (
                  <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    {t}
                  </span>
                ))
              ) : (
                <span className="font-mono text-[10px] text-slate-300">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
