"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClassifyStats, ReviewRow } from "@/lib/classify/store";

export function ClassifyClient({ stats, initialQueue }: { stats: ClassifyStats; initialQueue: ReviewRow[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initialQueue);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBatch() {
    setRunning(true); setError(null); setRunResult(null);
    try {
      const res = await fetch("/api/contacts/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classification failed.");
      setRunResult(`${data.resolved} auto-classified, ${data.ambiguous} sent to review · ${data.unclassifiedRemaining.toLocaleString()} still unclassified.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed.");
    } finally {
      setRunning(false);
    }
  }

  async function override(id: string, side: "founder" | "investor") {
    setBusyId(id); setError(null);
    try {
      const res = await fetch("/api/contacts/classify/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: id, side }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Override failed.");
      setQueue((q) => q.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed.");
    } finally {
      setBusyId(null);
    }
  }

  const pct = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Stats + run */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total contacts", value: stats.total.toLocaleString() },
            { label: "Classified", value: stats.classified.toLocaleString(), sub: `${pct}%` },
            { label: "Unclassified", value: stats.unclassified.toLocaleString() },
            { label: "Awaiting review", value: stats.reviewQueue.toLocaleString() },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-semibold text-slate-950">{s.value}{s.sub ? <span className="ml-1 text-sm font-medium text-emerald-600">{s.sub}</span> : null}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={runBatch}
            disabled={running || stats.unclassified === 0}
            className="rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {running ? "Classifying…" : "Run classification (next 200)"}
          </button>
          {runResult ? <span className="text-sm text-slate-600">{runResult}</span> : null}
        </div>
        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      </section>

      {/* Review queue */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Review queue</h2>
          <p className="text-xs text-slate-500">Ambiguous contacts — assign a side to move them into the pipeline.</p>
        </div>
        {queue.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing to review. Run classification to surface ambiguous contacts.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">{r.name || r.email || "Contact"}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.email}{r.company ? ` · ${r.company}` : ""}{r.company_domain ? ` · ${r.company_domain}` : ""}
                  </p>
                  {r.reason ? <p className="mt-0.5 text-[11px] text-slate-400">{r.reason}{r.side_confidence ? ` · ${r.side_confidence}% lean` : ""}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => override(r.id, "founder")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Founder
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => override(r.id, "investor")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Investor
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
