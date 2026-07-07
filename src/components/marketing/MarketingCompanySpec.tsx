/**
 * Illustrative "featured deal" spotlight for the marketing homepage: a company
 * spec sheet + a readiness / indicated-interest chart. Sample figures only —
 * clearly labeled, not live platform data. Mirrors the per-company detail view.
 */

const STATS = [
  { l: "TARGET", v: "$5.0M", tone: "text-[var(--navy)]" },
  { l: "INDICATED", v: "$1.8M", tone: "text-[var(--teal)]" },
  { l: "MIN CHECK", v: "$50k", tone: "text-[var(--navy)]" },
  { l: "WATCHING", v: "14", tone: "text-[var(--navy)]" },
];

const SPEC: [string, string, boolean?][] = [
  ["Sector", "HealthTech · Diagnostics"],
  ["Round", "Seed (priced)"],
  ["Target raise", "$5,000,000"],
  ["Valuation", "$22M post"],
  ["Min check", "$50,000"],
  ["Instrument", "Equity · SPV"],
  ["Location", "Boston, MA"],
  ["Founded", "2023"],
  ["Data room", "Ready · 12 docs", true],
  ["Diligence", "AI-scored · Tier B", true],
];

// Readiness curve (0–100 scale over ~90 days) and indicated-interest bars.
const LINE = "M55 116 L135 108 L215 100 L295 88 L375 78 L455 64 L560 52";
const BARS = [
  [70, 120, 20], [150, 112, 28], [230, 108, 32], [310, 98, 42], [390, 92, 48], [470, 82, 58], [550, 70, 70],
] as const;

export function MarketingCompanySpec() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      {/* Top strip */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">
          <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
          Featured deal
        </span>
        <span className="font-mono text-[10px] text-slate-400">Illustrative preview</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--navy)] font-mono text-[12px] font-medium text-white">SUM</div>
        <div className="min-w-[160px] flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] font-medium text-[var(--navy)]">SUMMIT</span>
            <span className="rounded-full bg-[var(--teal-muted)] px-2 py-0.5 font-mono text-[9.5px] text-[var(--teal)]">● LIVE</span>
          </div>
          <div className="text-[12px] text-slate-500">Summit Quantum Labs, Inc. · HealthTech · Seed</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[22px] font-semibold leading-none text-[var(--teal)]">72.4</div>
          <div className="mt-1 font-mono text-[9.5px] tracking-wide text-slate-400">READINESS · +6.1 30D</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 border-y border-slate-200 sm:grid-cols-4">
        {STATS.map((s, i) => (
          <div key={s.l} className={`border-slate-200 px-5 py-3.5 ${i < STATS.length - 1 ? "sm:border-r" : ""} ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b sm:border-b-0" : ""}`}>
            <div className="font-mono text-[9.5px] tracking-wide text-slate-400">{s.l}</div>
            <div className={`font-mono text-[16px] font-semibold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="px-5 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-slate-500">Readiness · last 90 days</span>
          <span className="font-mono text-[10.5px] text-[var(--teal)]">36% indicated of target</span>
        </div>
        <svg viewBox="0 0 640 170" className="block w-full" style={{ maxHeight: 170 }} role="img" aria-label="Readiness climbing from 40 to 72 over 90 days, with indicated-interest bars rising alongside">
          <line x1="40" y1="20" x2="620" y2="20" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="40" y1="80" x2="620" y2="80" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="40" y1="140" x2="620" y2="140" stroke="#cbd5e1" strokeWidth="1" />
          <text x="34" y="24" fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="monospace">100</text>
          <text x="34" y="84" fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="monospace">50</text>
          <text x="34" y="144" fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="monospace">0</text>
          {BARS.map(([x, y, h]) => <rect key={x} x={x} y={y} width="10" height={h} rx="2" fill="#B5D4F4" />)}
          <path d={`${LINE} L560 140 L55 140 Z`} fill="#0F6E56" opacity="0.08" />
          <path d={LINE} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="560" cy="52" r="4" fill="#0F6E56" />
          <text x="60" y="158" fontSize="9" fill="#94a3b8" fontFamily="monospace">90d ago</text>
          <text x="545" y="158" fontSize="9" fill="#94a3b8" fontFamily="monospace">today</text>
        </svg>
        <div className="mt-1.5 flex gap-4 font-mono text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-2.5 bg-[#0F6E56]" /> readiness</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-[#B5D4F4]" /> indicated interest</span>
        </div>
      </div>

      {/* Spec sheet */}
      <div className="px-5 pb-5 pt-4">
        <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-slate-500">Company spec</div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {SPEC.map(([k, v, accent], i) => (
            <div key={k} className={`flex justify-between py-1.5 text-[12px] ${i < SPEC.length - 2 ? "border-b border-slate-100" : ""}`}>
              <span className="text-slate-400">{k}</span>
              <span className={accent ? "text-[var(--teal)]" : "text-[var(--navy)]"}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="border-t border-slate-100 px-5 py-2.5 text-center font-mono text-[9.5px] text-slate-400">
        Illustrative preview — sample figures, not live platform data.
      </p>
    </div>
  );
}
