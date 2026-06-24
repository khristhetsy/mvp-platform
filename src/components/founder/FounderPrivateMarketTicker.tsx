import type { FounderInvestorRow } from "@/lib/founder/private-market";

/**
 * Scrolling strip of the founder's real ranked investors — handle, focus, match,
 * and check size. Real data only (identities stay anonymized); no fabricated
 * activity. CSS-only animation. Renders nothing when there are no investors.
 */
export function FounderPrivateMarketTicker({ rows }: Readonly<{ rows: FounderInvestorRow[] }>) {
  if (rows.length === 0) return null;
  const loop = [...rows, ...rows];

  return (
    <div className="cap-marquee-host">
      <div className="relative flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <span className="z-10 flex h-full items-center gap-2 border-r border-slate-200 bg-white px-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">
          <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
          Live
        </span>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" aria-hidden />
        <div className="cap-marquee flex w-max items-center whitespace-nowrap">
          {loop.map((r, i) => (
            <span
              key={`${r.symbol}-${i}`}
              className="flex h-5 items-center gap-2 border-r border-slate-200 px-5 text-[12.5px]"
            >
              <span className="font-mono text-[12px] font-semibold text-[var(--navy)]">{r.symbol}</span>
              {r.sectors[0] ? <span className="font-mono text-[11px] text-slate-400">{r.sectors[0]}</span> : null}
              <span className="font-mono text-[11px] font-semibold text-[var(--indigo)]">match {r.matchScore}</span>
              <span className="font-mono text-[11px] text-slate-500">{r.checkSize}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
