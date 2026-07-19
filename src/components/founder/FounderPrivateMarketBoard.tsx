import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FounderInvestorRow, OutreachStatus } from "@/lib/founder/private-market";

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

const OUTREACH_META: Record<OutreachStatus, { label: string; className: string; dot: string }> = {
  reached_out: { label: "Reached out", className: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  queued: { label: "Queued", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  skipped: { label: "Skipped", className: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  none: { label: "Not contacted", className: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);
}

function OutreachPill({ status }: { status: OutreachStatus }) {
  const m = OUTREACH_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const COLS = "sm:grid-cols-[1.7fr_0.7fr_1.1fr_1.1fr_1fr]";

export function FounderPrivateMarketBoard({ rows }: Readonly<{ rows: FounderInvestorRow[] }>) {
  const t = useTranslations("founderCmp");
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
            <h2 className="text-[15px] font-semibold text-[var(--navy)]">{t("investors")}</h2>
            <p className="font-mono text-[11px] text-slate-400">{rows.length} ranked to your company · best fit first</p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-slate-400">{t("identities_hidden")}</span>
      </div>

      <div className={`hidden gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-400 sm:grid ${COLS}`}>
        <div>{t("investor")}</div>
        <div className="text-right">{t("match")}</div>
        <div className="text-center">Outreach</div>
        <div className="text-center">Pledge</div>
        <div className="text-center">Investor score</div>
      </div>

      <div>
        {rows.map((r) => (
          <div
            key={r.symbol}
            className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] sm:grid ${COLS}`}
          >
            {/* investor */}
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold ${SIGIL[r.band]}`}>
                {r.symbol.replace("INV·", "").slice(0, 3)}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold text-[var(--navy)]">{r.symbol}</div>
                <div className="truncate text-[11.5px] text-slate-400">{r.label}</div>
              </div>
            </div>

            {/* match */}
            <div className="text-right">
              <div className={`font-mono text-[19px] font-semibold leading-none ${PRICE[r.band]}`}>{r.matchScore}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">{BAND_LABEL[r.band]}</div>
            </div>

            {/* outreach */}
            <div className="flex items-center justify-start sm:justify-center">
              <OutreachPill status={r.outreach} />
            </div>

            {/* pledge */}
            <div className="text-left sm:text-center">
              {r.indicated > 0 ? (
                <>
                  <div className="inline-flex items-center rounded-full bg-[var(--blue-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--blue-hover)]">
                    Soft pledge
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{money(r.indicated)} indicated</div>
                </>
              ) : (
                <span className="font-mono text-[12px] text-slate-300">—</span>
              )}
            </div>

            {/* investor score */}
            <div className="text-left sm:text-center">
              {r.scoreRated && r.investorScore != null ? (
                <>
                  <div className="font-mono text-[17px] font-semibold leading-none text-[var(--navy)]">{r.investorScore}</div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">
                    {r.scoreTier ?? "Rated"}
                  </div>
                </>
              ) : (
                <div className="font-mono text-[10px] text-slate-400" title="Not enough investor activity to score yet">
                  Insufficient data
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
