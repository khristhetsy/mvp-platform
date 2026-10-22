"use client";

/**
 * Landing view of the Proof tab: the population statement, the five tiles, the
 * before and after chart, band movement, the proof funnel and who needs work.
 * Every figure is computed by proofStats from platform records.
 */
import { MetricCard } from "@/components/MetricCard";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import { changeOf, isMeasured, signed, statementOf, type ProofCompany, type ProofStats } from "@/lib/crr/proof";
import type { Band } from "@/lib/crr/profiles";

const BANDS: Band[] = ["Early", "Developing", "Solid", "Strong"];
const BAND_FILL: Record<Band, string> = { Early: "#cbd5e1", Developing: "#a5b4fc", Solid: "#6366f1", Strong: "#3730a3" };

export function ProofDashboard({ list, stats, gate, onOpen }: { list: ProofCompany[]; stats: ProofStats; gate: number; onOpen: (id: string) => void }) {
  const measured = list.filter(isMeasured).sort((a, b) => (changeOf(b) as number) - (changeOf(a) as number));
  const W = 640, ROW = 26, H = measured.length * ROW + 30;
  const x = (v: number) => 150 + (Math.max(0, Math.min(100, v)) / 100) * (W - 190);
  const maxBand = Math.max(1, ...BANDS.map((b) => Math.max(stats.bandsFirst[b], stats.bandsNow[b])));
  const funnel = [
    { label: "All founders", n: stats.total },
    { label: "Measured before and after", n: stats.measured },
    { label: "Plus quote permission", n: list.filter((c) => isMeasured(c) && c.quote === "yes").length },
    { label: "Plus platform activity", n: stats.fullyProven },
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[13.5px] font-semibold text-indigo-950">{statementOf(stats)}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Measured before and after" value={`${stats.measured} of ${stats.total}`} detail="Source: score history" accent="indigo" />
        <MetricCard label="Average CRR change" value={stats.avg === null ? "n/a" : `${signed(stats.avg)} pts`} detail={stats.median === null ? "No measured founders" : `Median ${signed(stats.median)}. Source: score history`} accent="indigo" />
        <MetricCard label={`At or past gate (${gate})`} value={`${stats.gateNow} of ${stats.total}`} detail={`${stats.gateFirst} at their first score. Source: score history`} accent="indigo" />
        <MetricCard label="Quote permission" value={`${stats.quoteYes} of ${stats.total}`} detail="Source: approved submissions" accent="indigo" />
        <MetricCard label="Proven on all three" value={`${stats.fullyProven} of ${stats.total}`} detail="Before and after, quote, activity" accent="indigo" />
      </div>

      <WorkspaceSection icon="ti-chart-dots" tone="blue" title="Where each founder started and is now" subtitle="First score to latest score, under the active weighting. Dashed line is the outreach gate.">
        {measured.length === 0 ? (
          <p className="text-[13px] text-slate-500">No founder has two score rows yet, so there is no before and after to draw.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Before and after CRR by founder">
            <line x1={x(gate)} x2={x(gate)} y1={6} y2={H - 22} stroke="#94a3b8" strokeDasharray="4 4" />
            <text x={x(gate)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">Gate {gate}</text>
            {measured.map((c, i) => {
              const y = 16 + i * ROW;
              return (
                <g key={c.companyId} onClick={() => onOpen(c.companyId)} style={{ cursor: "pointer" }}>
                  <title>{`${c.companyName}: ${c.first!.score} to ${c.latest!.score} (${signed(changeOf(c) as number)})`}</title>
                  <text x={144} y={y + 4} textAnchor="end" fontSize="11.5" fill="#0f172a">{c.companyName.length > 22 ? `${c.companyName.slice(0, 21)}…` : c.companyName}</text>
                  <line x1={x(c.first!.score)} x2={x(c.latest!.score)} y1={y} y2={y} stroke="#6366f1" strokeWidth="2" />
                  <circle cx={x(c.first!.score)} cy={y} r="4.5" fill="#fff" stroke="#6366f1" strokeWidth="2" />
                  <circle cx={x(c.latest!.score)} cy={y} r="4.5" fill="#4338ca" stroke="#fff" strokeWidth="1.5" />
                  <text x={x(c.latest!.score) + 10} y={y + 4} fontSize="11" fill="#334155">{`${c.first!.score} → ${c.latest!.score}`}</text>
                </g>
              );
            })}
          </svg>
        )}
        <p className="mt-2 text-[11.5px] text-slate-500">Open circle: first score. Filled circle: latest. Click a row to open that founder.</p>
      </WorkspaceSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceSection icon="ti-chart-bar" tone="purple" title="Band movement" subtitle="Founders per band at first score and now">
          <div className="space-y-2">
            {BANDS.map((b) => (
              <div key={b} className="grid grid-cols-[84px_1fr] items-center gap-2 text-[12px]">
                <span className="text-slate-600">{b}</span>
                <span className="space-y-1">
                  {([["First", stats.bandsFirst[b], "#cbd5e1"], ["Now", stats.bandsNow[b], BAND_FILL[b]]] as const).map(([lab, n, fill]) => (
                    <span key={lab} className="flex items-center gap-2">
                      <span className="w-8 text-slate-400">{lab}</span>
                      <span className="h-3 rounded-r" style={{ width: `${(n / maxBand) * 100}%`, minWidth: n ? 4 : 0, background: fill }} />
                      <span className="tabular-nums text-slate-700">{n}</span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon="ti-filter" tone="teal" title="Proof readiness" subtitle="How many founders you can back on each claim today">
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.label} className="grid grid-cols-[170px_1fr_32px] items-center gap-2 text-[12px]">
                <span className="text-slate-600">{f.label}</span>
                <span className="h-3 rounded-r bg-teal-600" style={{ width: `${stats.total ? (f.n / stats.total) * 100 : 0}%`, minWidth: f.n ? 4 : 0 }} />
                <span className="text-right tabular-nums text-slate-700">{f.n}</span>
              </div>
            ))}
          </div>
        </WorkspaceSection>
      </div>

      <WorkspaceSection icon="ti-alert-triangle" tone="amber" title="Needs attention" subtitle="What stops a founder being proven. Ordered by most gaps.">
        {stats.needs.length === 0 ? (
          <p className="text-[13px] text-slate-500">Every founder is proven on all three.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.needs.slice(0, 12).map(({ company, missing }) => (
              <li key={company.companyId}>
                <button type="button" onClick={() => onOpen(company.companyId)} className="flex w-full flex-wrap items-center gap-2 py-2 text-left hover:bg-slate-50">
                  <span className="min-w-[160px] text-[13px] font-semibold text-slate-900">{company.companyName}</span>
                  {missing.map((m) => (
                    <span key={m.key} className={`rounded-full px-2 py-0.5 text-[11px] ${m.tone === "bad" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{m.label}</span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        )}
        {stats.needs.length > 12 ? <p className="mt-2 text-[11.5px] text-slate-500">Showing 12 of {stats.needs.length}. Use search to find the rest.</p> : null}
      </WorkspaceSection>
    </div>
  );
}
