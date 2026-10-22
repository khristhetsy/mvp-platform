"use client";

/**
 * One company's proof report. Everything here is read from platform records and
 * computed by proof.ts. The claim ledger says plainly which claims the platform
 * can back today and which to close or cut.
 */
import { MetricCard } from "@/components/MetricCard";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import { EVIDENCE, SOURCES } from "@/lib/crr/proof-evidence";
import { announcementFor, changeOf, claimsFor, evidenceFlags, isMeasured, monthsLabel, monthsOf, signed, type ProofCompany } from "@/lib/crr/proof";
import { improvementSteps, toolFor } from "@/lib/crr/improvement";
import { DIMENSION_LABEL } from "@/lib/crr/weight-sets";
import type { Dimension } from "@/lib/crr/profiles";

const DIMS: Dimension[] = ["narrative", "team", "financial", "traction", "capTable"];
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Timeline({ points, gate }: { points: Array<{ score: number; at: string }>; gate: number }) {
  const W = 640, H = 170, L = 34, R = 16, T = 12, B = 26;
  const t0 = Date.parse(points[0].at), t1 = Date.parse(points[points.length - 1].at);
  const x = (at: string) => L + (t1 === t0 ? 0.5 : (Date.parse(at) - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="CRR score over time">
      {[0, 25, 50, 75, 100].map((v) => (<g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e8f0" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{v}</text></g>))}
      <line x1={L} x2={W - R} y1={y(gate)} y2={y(gate)} stroke="#94a3b8" strokeDasharray="4 4" />
      <text x={W - R} y={y(gate) - 4} textAnchor="end" fontSize="10" fill="#64748b">Gate {gate}</text>
      <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={points.map((p) => `${x(p.at)},${y(p.score)}`).join(" ")} />
      {points.map((p, i) => (
        <g key={i}><title>{`${p.score} on ${fmtDate(p.at)}`}</title><circle cx={x(p.at)} cy={y(p.score)} r="4.5" fill={i === points.length - 1 ? "#4338ca" : "#fff"} stroke="#6366f1" strokeWidth="2" /></g>
      ))}
      <text x={x(points[0].at)} y={H - 8} textAnchor="start" fontSize="10" fill="#64748b">{fmtDate(points[0].at)}</text>
      <text x={x(points[points.length - 1].at)} y={H - 8} textAnchor="end" fontSize="10" fill="#64748b">{fmtDate(points[points.length - 1].at)}</text>
    </svg>
  );
}

export function ProofCompanyView({ c, gate }: { c: ProofCompany; gate: number }) {
  const measured = isMeasured(c);
  const d = changeOf(c);
  const claims = claimsFor(c);
  const steps = improvementSteps(c.gaps, 5);
  const act = c.activity;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{c.companyName}</h2>
        <span className="text-[12.5px] text-slate-500">{[c.founderName, c.profileLabel, c.industry].filter(Boolean).join(" · ")}</span>
      </div>

      {evidenceFlags(c).length > 0 ? (
        <p role="note" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800"><b>Check before you state this figure:</b> {evidenceFlags(c).map((f) => f.label).join(". ")}.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="CRR before and now" value={c.first && c.latest ? `${c.first.score} → ${c.latest.score}` : c.latest ? `${c.latest.score}` : "Not scored"} detail="Source: score history" accent="indigo" />
        <MetricCard label="Change" value={d === null ? "n/a" : `${signed(d)} pts`} detail={measured ? `Over ${monthsLabel(monthsOf(c))}. Source: score history` : "Needs a second score"} accent="indigo" />
        <MetricCard label="Quote permission" value={c.quote === "yes" ? "Yes" : c.quote === "pending" ? "Pending" : "None"} detail="Source: founder testimonials" accent="indigo" />
        <MetricCard label="Investor activity" value={act ? `${act.meetings + act.conversations + act.intros}` : "None recorded"} detail={act ? "Platform records, not founder reported" : "Nothing in platform records"} accent="indigo" />
      </div>

      <WorkspaceSection icon="ti-timeline" tone="blue" title="CRR over time" subtitle="Every scoring event, under the active weighting. Re-weighting rows are left out.">
        {c.history.length === 0 ? <p className="text-[13px] text-slate-500">This company has not been scored.</p> : <Timeline points={c.history} gate={gate} />}
        {c.history.length === 1 ? <p className="mt-1 text-[12px] text-amber-800">Only one score so far. A before and after needs a second.</p> : null}
      </WorkspaceSection>

      {c.first && c.latest ? (
        <WorkspaceSection icon="ti-layout-list" tone="purple" title="Five dimensions" subtitle="First score and latest score, 0 to 100 each">
          <div className="space-y-2.5">
            {DIMS.map((k) => {
              const a = Math.round(c.first!.dims[k]), b = Math.round(c.latest!.dims[k]);
              return (
                <div key={k} className="grid grid-cols-[96px_1fr_88px] items-center gap-2 text-[12.5px]">
                  <span className="text-slate-700">{DIMENSION_LABEL[k]}</span>
                  <span className="relative h-2.5 rounded bg-slate-100">
                    <span className="absolute inset-y-0 left-0 rounded bg-indigo-200" style={{ width: `${a}%` }} />
                    <span className="absolute inset-y-0 left-0 rounded bg-indigo-600 opacity-80" style={{ width: `${b}%`, height: 5, top: 3 }} />
                  </span>
                  <span className="text-right tabular-nums text-slate-700">{a} → {b} <span className={b - a > 0 ? "text-emerald-700" : "text-slate-400"}>({signed(b - a)})</span></span>
                </div>
              );
            })}
          </div>
        </WorkspaceSection>
      ) : null}

      <WorkspaceSection icon="ti-users" tone="teal" title="Testimonial and investor activity" subtitle="Platform records only">
        <ul className="space-y-1.5 text-[13px] text-slate-700">
          <li><b>Quote permission:</b> {c.quote === "yes" ? "Approved submission on file." : c.quote === "pending" ? "A submission is pending review." : "No submission on file."}</li>
          <li><b>Meetings:</b> {act ? `${act.meetings} accepted or scheduled` : "none recorded"}</li>
          <li><b>Intro requests:</b> {act ? act.intros : "none recorded"}</li>
          <li><b>Active conversations:</b> {act ? act.conversations : "none recorded"}</li>
        </ul>
      </WorkspaceSection>

      <WorkspaceSection icon="ti-bulb" tone="amber" title="Why each category matters to investors" subtitle="Sourced investor data, its population, and the chain from fact to conclusion. Association, not cause.">
        <div className="grid gap-3 md:grid-cols-2">
          {EVIDENCE.map((e) => {
            const delta = c.first && c.latest ? Math.round(c.latest.dims[e.dimension] - c.first.dims[e.dimension]) : null;
            return (
              <div key={e.dimension} className="rounded-xl border border-slate-200 p-3.5 text-[12.5px] leading-snug text-slate-700 break-inside-avoid">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-900">{DIMENSION_LABEL[e.dimension]}</span>
                  {delta !== null ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{c.companyName}: {signed(delta)}</span> : null}
                </div>
                <ul className="space-y-1">
                  <li><b>Investor data:</b> {e.data.join(" ")}</li>
                  <li><b>Population:</b> {e.population.join(" ")}</li>
                  <li><b>Why it matters:</b> {e.why}</li>
                  <li><b>Data gap:</b> {e.gap}</li>
                  <li><b>Sources:</b> {e.sources.map((s, i) => (<span key={s}>{i ? "; " : ""}<a href={SOURCES[s].url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{SOURCES[s].label}</a></span>))}</li>
                </ul>
              </div>
            );
          })}
        </div>
      </WorkspaceSection>

      <WorkspaceSection icon="ti-route" tone="green" title="How the founder raises CRR on iCapOS" subtitle="Biggest gain first, at this company's stage. Points are CRR points.">
        {steps.length === 0 ? <p className="text-[13px] text-slate-500">No open gaps above half a point, or the company has not been scored.</p> : (
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const tool = toolFor(s.key);
              return (
                <li key={s.key} className="flex gap-3 text-[13px]">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">{i + 1}</span>
                  <span>
                    <b className="text-slate-900">{s.action}</b> <span className="text-slate-500">up to +{s.upTo} pts, {s.dimension}</span>
                    <span className="block text-[12px] text-slate-500">Where: {s.href}{tool ? `. Tool: ${tool.tool}` : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </WorkspaceSection>

      <WorkspaceSection icon="ti-file-text" tone="gray" title="Draft announcement" subtitle="States what was measured. Does not claim iCapOS caused any outcome.">
        <p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800">{announcementFor(c)}</p>
      </WorkspaceSection>

      <WorkspaceSection icon="ti-checklist" tone="red" title="Claim ledger" subtitle="Every claim above, the evidence behind it, and whether to close or cut it">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500"><th className="py-1.5 pr-3">Claim</th><th className="pr-3">Evidence</th><th className="pr-3">Status</th><th>Action</th></tr></thead>
            <tbody>
              {claims.map((k) => (
                <tr key={k.claim} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-900">{k.claim}</td>
                  <td className="pr-3 text-slate-600">{k.evidence}</td>
                  <td className="pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] ${k.ok ? "bg-emerald-50 text-emerald-700" : k.tone === "bad" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{k.ok ? "Provable" : "Gap"}</span></td>
                  <td className="text-slate-600">{k.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkspaceSection>
    </div>
  );
}
