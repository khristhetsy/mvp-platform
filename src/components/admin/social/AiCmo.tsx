"use client";

import { useState } from "react";

/**
 * AI CMO assistant — a context-aware advisor shown on every Hub tab. Renders a compact
 * inline tip strip; expanding it fetches advice from /api/admin/social/cmo for the
 * current tab + a snapshot of what's on screen. Optional actions map recommendations to
 * one-click handlers supplied by the host tab.
 */
export type CmoAction = { label: string; onClick: () => void };

export function AiCmo({ tab, context, actions, className }: {
  tab: string;
  context: () => Record<string, unknown>;
  actions?: CmoAction[];
  className?: string;
}) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [degraded, setDegraded] = useState(false);

  async function ask(question?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/social/cmo", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tab, question, context: context() }),
      });
      const d = await res.json().catch(() => ({}));
      setAdvice(d.advice ?? "No suggestion available.");
      setDegraded(Boolean(d.degraded));
    } catch { setAdvice("Couldn't reach the advisor."); }
    setBusy(false);
  }

  return (
    <div className={`rounded-xl border border-indigo-200 bg-indigo-50/60 px-3.5 py-2.5 ${className ?? ""}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">✦</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-indigo-700">AI CMO</span>
            {degraded ? <span className="text-[10px] text-slate-400">rule-based</span> : null}
            {!advice && !busy ? (
              <button type="button" onClick={() => { setOpen(true); void ask(); }} className="text-[11.5px] font-medium text-indigo-600 hover:underline">Advise me →</button>
            ) : null}
            {busy ? <span className="text-[11px] text-slate-500">Thinking…</span> : null}
          </div>
          {advice ? <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{advice}</p> : (
            <p className="mt-0.5 text-[11.5px] text-slate-500">Ask for a recommendation on what&rsquo;s on this tab.</p>
          )}

          {actions && actions.length && advice ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {actions.map((a) => (
                <button key={a.label} type="button" onClick={a.onClick} className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50">{a.label}</button>
              ))}
            </div>
          ) : null}

          {open ? (
            <div className="mt-2 flex items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) void ask(q.trim()); }}
                placeholder="Ask a question…" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-300" />
              <button type="button" disabled={busy || !q.trim()} onClick={() => void ask(q.trim())} className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11.5px] font-medium text-white disabled:opacity-50">Ask</button>
            </div>
          ) : (
            advice ? <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-[11px] text-indigo-500 hover:underline">Ask a follow-up…</button> : null
          )}
        </div>
      </div>
    </div>
  );
}
