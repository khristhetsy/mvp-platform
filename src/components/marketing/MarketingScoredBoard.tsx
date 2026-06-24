import { LayoutGrid } from "lucide-react";

export type ScoredBoardRow = {
  symbol: string;
  name: string;
  score: number;
  band: "high" | "mid" | "low";
  metricMain: string;
  metricSub: string;
  tags: string[];
};

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
const BAND_LABEL: Record<string, string> = {
  high: "Strong",
  mid: "Moderate",
  low: "Building",
};

/**
 * Illustrative scored board for marketing pages (investors or deals). Sample
 * data only — presents the product surface, not live platform activity.
 */
export function MarketingScoredBoard({
  title,
  meta,
  scoreLabel,
  metricLabel,
  rows,
  note = "Illustrative",
  bare = false,
}: Readonly<{
  title: string;
  meta: string;
  scoreLabel: string;
  metricLabel: string;
  rows: ScoredBoardRow[];
  note?: string;
  bare?: boolean;
}>) {
  return (
    <div className={bare ? "" : "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]"}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
            <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--navy)]">{title}</h3>
            <p className="font-mono text-[11px] text-slate-400">{meta}</p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-slate-400">{note}</span>
      </div>

      <div className="hidden grid-cols-[1.7fr_0.9fr_1.1fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-400 sm:grid">
        <div>Symbol</div>
        <div className="text-right">{scoreLabel}</div>
        <div>{metricLabel}</div>
        <div>Sector</div>
      </div>

      <div>
        {rows.map((r) => (
          <div
            key={r.symbol}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--blue-muted)] sm:grid-cols-[1.7fr_0.9fr_1.1fr_0.8fr]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold ${SIGIL[r.band]}`}>
                {r.symbol.slice(0, 3)}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold text-[var(--navy)]">{r.symbol}</div>
                <div className="truncate text-[11.5px] text-slate-400">{r.name}</div>
              </div>
            </div>

            <div className="text-right">
              <div className={`font-mono text-[19px] font-semibold leading-none ${PRICE[r.band]}`}>
                {r.score.toFixed(1)}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-slate-400">
                {BAND_LABEL[r.band]}
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="font-mono text-[12.5px] font-semibold text-slate-700">{r.metricMain}</div>
              <div className="font-mono text-[10px] text-slate-400">{r.metricSub}</div>
            </div>

            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {r.tags.map((t) => (
                <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
