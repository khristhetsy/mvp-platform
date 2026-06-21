"use client";

import { FileDown } from "lucide-react";
import { StateChip } from "./StateChip";
import type { ReportPayload } from "@/lib/diligence/serialize";
import type { Severity, Verification } from "@/lib/diligence/types";

export function InvestorCut({ dealId, payload }: { dealId: string; payload: ReportPayload }) {
  const eng = payload.engagement as Record<string, unknown>;
  const findings = payload.findings as Record<string, unknown>[];
  const responses = payload.responses as Record<string, unknown>[];
  const conditions = payload.conditions as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6cb0]">{String(eng.report_code ?? "")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{String(eng.company_name ?? "Deal")}</h1>
        <p className="mt-1 text-sm text-slate-500">{[eng.round_label, eng.sector].filter(Boolean).join(" · ") || "Released diligence package"}</p>
        <a href={`/api/investor/deals/${dealId}/export`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <FileDown className="h-4 w-4" /> Download PDF
        </a>
      </div>

      {eng.posture || eng.recommendation ? (
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          <h2 className="text-sm font-semibold text-slate-800">Verdict</h2>
          {eng.posture ? <p className="mt-1 text-sm text-slate-700"><span className="font-medium">Posture:</span> {String(eng.posture)}</p> : null}
          {eng.recommendation ? <p className="mt-1 text-sm text-slate-700"><span className="font-medium">Recommendation:</span> {String(eng.recommendation)}</p> : null}
        </section>
      ) : null}

      {findings.length ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Findings</h2>
          <ul className="divide-y divide-slate-50">
            {findings.map((f) => (
              <li key={String(f.id)} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{String(f.finding_code ?? "")}</span>
                  <span className="font-medium text-slate-900">{String(f.title ?? "")}</span>
                  <StateChip variant={String(f.severity) as Severity} />
                  <StateChip variant={String(f.verification) as Verification} />
                </div>
                {f.detail ? <p className="mt-1 text-sm text-slate-600">{String(f.detail)}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {responses.length ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Founder responses</h2>
          <ul className="divide-y divide-slate-50">
            {responses.map((r) => (
              <li key={String(r.id)} className="px-4 py-3">
                <p className="text-xs text-slate-500"><span className="font-mono">{Array.isArray(r.finding_codes) ? (r.finding_codes as string[]).join(", ") : ""}</span> · <span className="capitalize">{String(r.disposition ?? "")}</span></p>
                <p className="mt-1 text-sm text-slate-700">{String(r.body ?? "")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {conditions.length ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Conditions</h2>
          <ul className="divide-y divide-slate-50">
            {conditions.map((c) => (
              <li key={String(c.id)} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-800">{String(c.label ?? "")}</span>
                <span className="text-xs capitalize text-slate-500">{String(c.status ?? "").replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
