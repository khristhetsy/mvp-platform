"use client";

// Read-only "document page" preview of the section currently being edited.
// Mirrors the PDF layout (src/lib/business-plan/pdf.ts) in HTML/SVG and updates
// live from the editor's state. Current section only.
import type {
  AllocationSlice,
  MarketSize,
  PainBar,
  BeforeAfter,
  MatrixPoint,
  TractionChart,
} from "@/lib/business-plan/charts";

const ALLOC_HEX = ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834", "#008300"];

interface Projections {
  years: { year: number; revenue: number; grossProfit: number; operatingExpense: number; netCashFlow: number }[];
  runwayMonths?: number | null;
  endingCash: number;
}

function moneyShort(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}k` : `$${Math.round(a)}`;
  return n < 0 ? `-${s}` : s;
}

function Bars({ rows, unit }: { rows: { label: string; value: number; suffix?: string }[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-20 flex-none truncate text-right text-[10px] text-[#334155]">{r.label}</span>
          <div className="h-2.5 flex-1 rounded-sm bg-slate-100">
            <div className="h-full rounded-sm bg-[#2E78F5]" style={{ width: `${Math.max((r.value / max) * 100, 3)}%` }} />
          </div>
          <span className="w-12 flex-none text-[9px] text-[#64748b]">{r.suffix ?? `${r.value}${unit ? ` ${unit}` : ""}`}</span>
        </div>
      ))}
    </div>
  );
}

function SectionChart({
  sectionId,
  market,
  allocation,
  problem,
  solution,
  competition,
  traction,
  projections,
}: {
  sectionId: string;
  market: MarketSize;
  allocation: AllocationSlice[];
  problem: PainBar[];
  solution: BeforeAfter[];
  competition: MatrixPoint[];
  traction: TractionChart;
  projections: Projections | null;
}) {
  const heading = (t: string) => (
    <p className="mb-2 mt-4 font-mono text-[8px] uppercase tracking-[0.08em] text-[#2E78F5]">{t}</p>
  );

  if (sectionId === "market") {
    const rows = ([["TAM", market.tam], ["SAM", market.sam], ["SOM", market.som]] as const)
      .filter(([, v]) => v != null)
      .map(([label, v]) => ({ label, value: v as number, suffix: moneyShort(v as number) }));
    if (!rows.length) return null;
    return (
      <>
        {heading("Market size")}
        <Bars rows={rows} />
      </>
    );
  }

  if (sectionId === "use_of_funds") {
    if (!allocation.length) return null;
    return (
      <>
        {heading("Use of funds")}
        <div className="space-y-1">
          {allocation.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-[#334155]">
              <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: ALLOC_HEX[i % ALLOC_HEX.length] }} />
              <span className="flex-1">{a.label}</span>
              <span className="text-[#64748b]">{a.pct}%</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (sectionId === "problem") {
    if (!problem.length) return null;
    return (
      <>
        {heading("Cost of the status quo")}
        <Bars rows={problem.map((p) => ({ label: p.label, value: p.value, suffix: `${p.value}${p.unit ? ` ${p.unit}` : ""}` }))} />
      </>
    );
  }

  if (sectionId === "solution") {
    if (!solution.length) return null;
    return (
      <>
        {heading("Before and after")}
        <div className="space-y-1 text-[10px] text-[#334155]">
          {solution.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{s.label}</span>
              <span className="flex-none text-[#64748b]">
                {s.before} <span className="text-[#2E78F5]">→</span> {s.after}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (sectionId === "competition") {
    if (!competition.length) return null;
    return (
      <>
        {heading("Positioning")}
        <div className="space-y-1 text-[10px]">
          {competition.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 flex-none rounded-sm" style={{ background: p.you ? "#2E78F5" : "#94a3b8" }} />
              <span className={p.you ? "font-medium text-[#0c2340]" : "text-[#334155]"}>
                {p.label}
                {p.you ? " (you)" : ""}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (sectionId === "traction") {
    if (!traction.series.length) return null;
    const max = Math.max(...traction.series.map((p) => p.value), 1);
    return (
      <>
        {heading("Traction over time")}
        <div className="flex items-end gap-1" style={{ height: 42 }}>
          {traction.series.map((p, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-sm bg-[#1baf7a]" style={{ height: `${Math.max((p.value / max) * 34, 2)}px` }} />
              <span className="text-[7px] text-[#94a3b8]">{p.period}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (sectionId === "projections" && projections) {
    return (
      <>
        {heading("Financial projections")}
        <table className="w-full text-[9px]">
          <thead>
            <tr className="text-[#94a3b8]">
              <th className="text-left font-normal"></th>
              <th className="text-right font-normal">Y1</th>
              <th className="text-right font-normal">Y2</th>
              <th className="text-right font-normal">Y3</th>
            </tr>
          </thead>
          <tbody className="text-[#334155]">
            {([["Revenue", "revenue"], ["Gross profit", "grossProfit"], ["Net cash", "netCashFlow"]] as const).map(([label, key]) => (
              <tr key={key}>
                <td className="text-[#64748b]">{label}</td>
                {projections.years.slice(0, 3).map((y) => (
                  <td key={y.year} className="text-right tabular-nums">{moneyShort(y[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return null;
}

export function BusinessPlanLivePreview(props: {
  sectionId: string;
  sectionTitle: string;
  content: string;
  companyName?: string | null;
  market: MarketSize;
  allocation: AllocationSlice[];
  problem: PainBar[];
  solution: BeforeAfter[];
  competition: MatrixPoint[];
  traction: TractionChart;
  projections: Projections | null;
}) {
  const { sectionId, sectionTitle, content, companyName } = props;
  return (
    <div className="lg:sticky lg:top-4">
      <p className="mb-1.5 text-xs text-[var(--text-muted)]">Live preview</p>
      <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-4 shadow-sm" style={{ minHeight: 320 }}>
        <p className="font-mono text-[7px] uppercase tracking-[0.1em] text-[#2E78F5]">
          Business plan · {sectionTitle}
        </p>
        {companyName && <p className="mt-0.5 text-[13px] font-semibold text-[#0c2340]">{companyName}</p>}
        <p className="mt-2 text-[12px] font-semibold text-[#0c2340]">{sectionTitle}</p>

        {content.trim() ? (
          <p className="mt-1.5 whitespace-pre-wrap text-[9.5px] leading-[1.55] text-[#334155]">{content}</p>
        ) : (
          <p className="mt-1.5 text-[9.5px] italic text-[#94a3b8]">
            Start writing on the left — or click “Draft with AI” — and this page fills in.
          </p>
        )}

        <SectionChart
          sectionId={sectionId}
          market={props.market}
          allocation={props.allocation}
          problem={props.problem}
          solution={props.solution}
          competition={props.competition}
          traction={props.traction}
          projections={props.projections}
        />

        <p className="mt-4 text-[7.5px] leading-[1.4] text-[#94a3b8]">
          Auto-drawn from your chart data. Illustrative only — not a forecast, guarantee, or investment advice.
        </p>
      </div>
    </div>
  );
}
