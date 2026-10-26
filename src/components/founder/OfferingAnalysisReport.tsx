"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeOffering, type AnalysisRow, type Tone } from "@/lib/founder/round-structure/analysis";
import type { RoundInputs } from "@/lib/founder/round-structure/model";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  near: { bg: "#E3EEFF", fg: "#1B4DB1" },
  above: { bg: "#FFF1DB", fg: "#7A4300" },
  context: { bg: "#EEF1F7", fg: "#3A4767" },
};

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>
      {children}
    </span>
  );
}

function RefTag({ ids }: { ids: number[] }) {
  return (
    <span className="text-[11px] font-semibold" style={{ color: "#1B4DB1" }}>
      {ids.length === 1 ? "Ref" : "Refs"}{" "}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 ? ", " : ""}
          <a href={`#round-ref-${id}`} className="underline">{id}</a>
        </span>
      ))}
    </span>
  );
}

function BarPair({ row }: { row: AnalysisRow }) {
  if (row.yourValue == null || row.benchValue == null) return null;
  const max = Math.max(row.yourValue, row.benchValue) || 1;
  const line = (label: string, value: string, width: number, color: string) => (
    <div className="flex items-center gap-2.5">
      <span className="w-[72px] text-[11px] text-slate-500">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-slate-100">
        <div className="h-2.5 rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="w-[72px] text-right text-xs font-bold text-slate-900">{value}</span>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {line("You", row.you, (row.yourValue / max) * 100, "#2563EB")}
      {line("Benchmark", row.bench ?? "", (row.benchValue / max) * 100, "#7C8BAA")}
    </div>
  );
}

type SummaryState =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "none"; note: string };

/**
 * The AI offering analysis. Every figure comes from the sourced benchmark library
 * (lib/founder/round-structure), so the report appears at once. The AI only writes
 * the plain language summary on top, and nothing here is saved or sent.
 */
export function OfferingAnalysisReport({ inputs }: { inputs: RoundInputs }) {
  const analysis = useMemo(() => analyzeOffering(inputs), [inputs]);
  const [summary, setSummary] = useState<SummaryState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/founder/round-structure/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { summary?: string | null; error?: string };
        if (res.ok && body.summary) setSummary({ status: "ready", text: body.summary });
        else if (res.status === 429) setSummary({ status: "none", note: body.error ?? "You have used your AI runs for this period. The report below is unaffected." });
        else setSummary({ status: "none", note: "The AI summary is not available right now. The report below is unaffected." });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setSummary({ status: "none", note: "The AI summary is not available right now. The report below is unaffected." });
      });
    return () => controller.abort();
  }, [inputs]);

  const o = analysis.ownership;

  return (
    <div id="offering-analysis-report" className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">AI offering analysis</p>
          <p className="text-[11px] text-slate-500">Benchmarks as of {analysis.asOf}. Every figure links to its source.</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
        >
          Print or save as PDF
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {analysis.inputsSummary.map((s) => (
          <span key={s} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "#E3EEFF", color: "#1B4DB1" }}>{s}</span>
        ))}
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
        {summary.status === "loading" ? (
          <p className="text-xs text-slate-500">Writing the summary from the figures below.</p>
        ) : summary.status === "ready" ? (
          <>
            <p className="text-xs leading-relaxed text-slate-800">{summary.text}</p>
            <p className="mt-1.5 text-[10px] text-slate-400">Written by AI using only the figures in this report.</p>
          </>
        ) : (
          <p className="text-xs text-slate-500">{summary.note}</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Ownership after this round</p>
        <div className="flex h-8 overflow-hidden rounded-lg">
          <div style={{ width: `${o.investors}%`, background: "#2563EB" }} title={`New investors ${o.investors.toFixed(1)}%`} />
          <div style={{ width: `${o.pool}%`, background: "#E8923B" }} title={`Option pool ${o.pool.toFixed(1)}%`} />
          <div style={{ width: `${o.existing}%`, background: "#0F1F4A" }} title={`Existing holders ${o.existing.toFixed(1)}%`} />
        </div>
        <div className="mt-2 space-y-1">
          {[
            ["#2563EB", "New investors", o.investors],
            ["#E8923B", "Option pool", o.pool],
            ["#0F1F4A", "Existing holders", o.existing],
          ].map(([color, label, v]) => (
            <div key={String(label)} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: String(color) }} />
              <span className="flex-1 text-slate-700">{String(label)}</span>
              <span className="font-mono font-semibold text-slate-900">{Number(v).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-500">
          {analysis.chain.map((c) => (<li key={c}>{c}</li>))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Benchmark comparison</p>
        <p className="mb-3 text-[11px] text-slate-500">Your value against the published figure. Each row names the group behind it.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {analysis.rows.map((row) => (
            <div key={row.key} className="space-y-2.5 rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{row.label}</p>
                <Chip tone={row.tone}>{row.statusLabel}</Chip>
              </div>
              <BarPair row={row} />
              {row.yourValue == null ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">You: <b className="text-slate-900">{row.you}</b></span>
                  <span className="text-slate-500">Benchmark: <b className="text-slate-900">{row.bench ?? "No dataset"}</b></span>
                </div>
              ) : null}
              <div className="space-y-0.5 border-t border-slate-100 pt-2">
                <p className="text-xs font-bold text-slate-900">{row.delta}</p>
                <p className="text-[11px] leading-snug text-slate-500">{row.population}</p>
                {row.sourceId ? <RefTag ids={[row.sourceId]} /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Findings</p>
        <div className="grid gap-3 md:grid-cols-2">
          {analysis.findings.map((f) => (
            <div key={f.key} className="space-y-2 rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-snug text-slate-900">{f.title}</p>
                <Chip tone={f.tone}>{f.tag}</Chip>
              </div>
              <div className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                <p><b className="text-slate-900">Data:</b> {f.data}</p>
                <p><b className="text-slate-900">What it means:</b> {f.means}</p>
                <p><b className="text-slate-900">{f.nextLabel}:</b> {f.next}</p>
              </div>
              <RefTag ids={f.sourceIds} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-slate-900">References</p>
        <p className="mb-3 text-[11px] text-slate-500">
          Retrieved {analysis.asOf}. Primary means the publisher page was read. Secondary means the figure was read in a summary that cites the publisher, so check it against the publisher before using it in an investor document.
        </p>
        <ol className="space-y-2">
          {analysis.sources.map((s) => (
            <li key={s.id} id={`round-ref-${s.id}`} className="flex gap-3 rounded-xl border border-slate-100 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "#E3EEFF", color: "#1B4DB1" }}>{s.id}</span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">{s.title}</p>
                <p className="text-[11px] leading-snug text-slate-600">{s.detail}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="block break-all text-[11px] text-slate-500 underline print:no-underline">{s.url}</a>
                <p className="text-[11px] font-bold" style={{ color: s.access === "primary" ? "#1B4DB1" : "#7A4300" }}>{s.access === "primary" ? "Primary" : "Secondary"}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        How this report is made: every number comes from the sourced benchmark library, not from the AI. The AI only writes the summary, and the summary is discarded if it contains a figure that is not in this report. Medians describe the market, not your round, and sector and location move them. Informational only, not legal, tax or investment advice.
      </p>
    </div>
  );
}
