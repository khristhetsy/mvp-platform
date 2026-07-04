"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AudienceStats, HotRow } from "@/lib/approach/store";

const SEG_STYLE: Record<string, { bg: string; color: string }> = {
  hot: { bg: "#FEF2F2", color: "#B91C1C" },
  warm: { bg: "#FFFBEB", color: "#92400E" },
  cold: { bg: "#F1F5F9", color: "#475569" },
};

export function AudienceClient({ stats, initialHot }: { stats: AudienceStats; initialHot: HotRow[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/contacts/approach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 300 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approach scoring failed.");
      setResult(`${data.processed} scored (${data.founders} founders, ${data.investors} investors) · ${data.hot} hot, ${data.warm} warm, ${data.cold} cold · ${data.remaining.toLocaleString()} remaining.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approach scoring failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          {[
            { label: "Classified", value: stats.classified },
            { label: "Scored", value: stats.approached },
            { label: "Pending", value: stats.pending },
            { label: "Hot", value: stats.hot, seg: "hot" },
            { label: "Warm", value: stats.warm, seg: "warm" },
            { label: "Cold", value: stats.cold, seg: "cold" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-xl font-semibold text-slate-950" style={s.seg ? { color: SEG_STYLE[s.seg].color } : undefined}>{s.value.toLocaleString()}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={run} disabled={running || stats.pending === 0}
            className="rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {running ? "Scoring…" : "Run approach scoring (next 300)"}
          </button>
          {result ? <span className="text-sm text-slate-600">{result}</span> : null}
        </div>
        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Hot queue</h2>
          <p className="text-xs text-slate-500">Highest-priority prospects — ranked by pre-score. Approach copy passes the compliance lint before any send.</p>
        </div>
        {initialHot.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No hot leads yet. Run approach scoring to populate.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {initialHot.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-950">{r.name || r.email || "Contact"}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: "#F1EFE8", color: "#5F5E5A" }}>{r.side}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{r.email}{r.company ? ` · ${r.company}` : ""}</p>
                  {r.hook ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{r.hook}</p> : null}
                </div>
                {typeof r.lead_prescore === "number" ? (
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700" title="Internal lead pre-score (never shown to the lead)">{r.lead_prescore}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
