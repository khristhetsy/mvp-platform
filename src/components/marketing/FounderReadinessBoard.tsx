import type { ReadinessBand, ReadinessBoard } from "@/lib/marketplace/readiness-board";

const BAND_COLOR: Record<ReadinessBand["key"], string> = {
  strong: "var(--teal)",
  moderate: "var(--blue)",
  building: "#64748b",
};

const countedOn = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Founder only stat card for the Deals hero. Real counts, no investor figures. */
export function FounderStatsCard({ board }: Readonly<{ board: ReadinessBoard }>) {
  const strong = board.bands.find((b) => b.key === "strong");
  const building = board.bands.find((b) => b.key === "building");
  const stats = [
    { v: String(board.scoredFounders), l: "scored founders", tone: "text-[var(--navy)]" },
    { v: board.avgScore === null ? "n/a" : board.avgScore.toFixed(1), l: "avg readiness", tone: "text-[var(--blue)]" },
    { v: String(strong?.founders ?? 0), l: "in the Strong band", tone: "text-[var(--teal)]" },
    { v: String(building?.founders ?? 0), l: "still building", tone: "text-slate-600" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">The Private Market</span>
        <span className="font-mono text-[10px] text-slate-500">Platform data · {countedOn()}</span>
      </div>
      <div className="grid grid-cols-2">
        {stats.map((s, i) => (
          <div
            key={s.l}
            className={`border-slate-200 px-5 py-5 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""}`}
          >
            <div className={`font-mono text-[32px] font-semibold leading-none ${s.tone}`}>{s.v}</div>
            <div className="mt-1.5 font-mono text-[11px] text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Band table: share of scored founders, count and average per band. */
export function FounderReadinessBoard({ board }: Readonly<{ board: ReadinessBoard }>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[var(--blue-muted)] px-5 py-4">
        <h3 className="text-[15px] font-semibold text-[var(--navy)]">Readiness board</h3>
        <span className="font-mono text-[11px] text-slate-600">
          {board.scoredFounders} scored founders · avg {board.avgScore === null ? "n/a" : board.avgScore.toFixed(1)}
        </span>
      </div>
      <div className="grid grid-cols-[1.1fr_2fr_0.6fr_0.7fr] gap-3 border-b border-slate-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
        <span>Band</span>
        <span>Share of scored</span>
        <span className="text-right">Founders</span>
        <span className="text-right">Avg score</span>
      </div>
      <ul>
        {board.bands.map((b) => (
          <li
            key={b.key}
            className="grid min-h-16 grid-cols-[1.1fr_2fr_0.6fr_0.7fr] items-center gap-3 border-b border-slate-100 px-5 font-mono text-[14px] last:border-b-0"
          >
            <span>
              <span className="block font-semibold text-[var(--navy)]">{b.label}</span>
              <span className="block text-[10px] uppercase tracking-[0.08em] text-slate-500">{b.range}</span>
            </span>
            <span className="flex items-center gap-2.5">
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <span className="block h-full rounded-full" style={{ width: `${b.sharePct}%`, background: BAND_COLOR[b.key] }} />
              </span>
              <span className="w-10 text-right font-semibold">{b.sharePct}%</span>
            </span>
            <span className="text-right font-semibold">{b.founders}</span>
            <span className="text-right font-semibold" style={{ color: BAND_COLOR[b.key] }}>
              {b.avgScore === null ? "n/a" : b.avgScore.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-slate-200 px-5 py-3 font-mono text-[10px] leading-relaxed text-slate-500">
        Latest score per founder company, sample accounts excluded. Company names and individual scores are not shown
        publicly. Informational only, not an investment recommendation.
      </p>
    </div>
  );
}
