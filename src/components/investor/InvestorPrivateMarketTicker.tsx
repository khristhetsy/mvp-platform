import type { PrivateMarketDeal } from "@/lib/investor/private-market";

/**
 * Scrolling strip of the investor's real matched deals — symbol, sector,
 * readiness, and % indicated. All values are the live state of the board; no
 * fabricated activity. CSS-only animation. Renders nothing when there are no deals.
 */
export function InvestorPrivateMarketTicker({ deals }: Readonly<{ deals: PrivateMarketDeal[] }>) {
  if (deals.length === 0) return null;
  const loop = [...deals, ...deals];

  return (
    <div className="cap-marquee-host">
      <div className="relative flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <span className="z-10 flex h-full items-center gap-2 border-r border-slate-200 bg-white px-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">
          <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
          Live
        </span>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" aria-hidden />
        <div className="cap-marquee flex w-max items-center whitespace-nowrap">
          {loop.map((d, i) => (
            <span
              key={`${d.companyId}-${i}`}
              className="flex h-5 items-center gap-2 border-r border-slate-200 px-5 text-[12.5px]"
            >
              <span className="font-mono text-[12px] font-semibold text-[var(--navy)]">{d.symbol}</span>
              {d.industry ? <span className="font-mono text-[11px] text-slate-400">{d.industry}</span> : null}
              <span className="font-mono text-[11px] text-slate-500">
                {d.readinessScore != null ? `readiness ${d.readinessScore.toFixed(1)}` : "readiness —"}
              </span>
              <span className="font-mono text-[11px] font-semibold text-[var(--teal)]">
                {d.fillPct != null ? `${d.fillPct}% indicated` : "—"}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
