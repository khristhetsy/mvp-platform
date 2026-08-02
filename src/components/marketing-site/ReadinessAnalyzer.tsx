"use client";

import { useState } from "react";

/**
 * AI readiness analyzer (spec §5, §7). Posts free text to /api/ai with task
 * "analyze_readiness"; the proxy validates the JSON contract server-side, so we
 * render trusted, typed fields only. Indicative estimate — never the real
 * rating, never a funding promise (§13, guardrails).
 */

type Analysis = {
  narrative: number;
  financial: number;
  traction: number;
  captable: number;
  team: number;
  summary: string;
  fixes: { area: string; action: string }[];
};

const DIMENSIONS: { key: keyof Analysis; label: string }[] = [
  { key: "narrative", label: "Narrative" },
  { key: "financial", label: "Financials" },
  { key: "traction", label: "Traction" },
  { key: "captable", label: "Cap table" },
  { key: "team", label: "Team" },
];

export function ReadinessAnalyzer({
  chips,
  cta,
  disclaimer,
}: {
  chips: readonly string[];
  cta: string;
  disclaimer: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  async function analyze() {
    const clean = text.trim();
    if (clean.length < 40) {
      setNote("Add a bit more — a couple of sentences about your company, traction and raise works best.");
      return;
    }
    setBusy(true);
    setNote(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "analyze_readiness", messages: [{ role: "user", content: clean }] }),
      });
      if (res.status === 429) {
        const d = await res.json().catch(() => null);
        setNote(d?.error ?? "You've hit the request limit — please try again shortly.");
        return;
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean; data?: Analysis } | null;
      if (data?.ok && data.data) setResult(data.data);
      else setNote("Couldn't analyze that just now. Please try again in a moment.");
    } catch {
      setNote("Network trouble reaching the analyzer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-2xl text-left">
      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (<span key={c} className="rounded-full border border-site-line bg-site-paper px-3 py-1 text-[13px] text-site-ink">{c}</span>))}
      </div>
      <label htmlFor="analyzer-input" className="sr-only">Describe your company, traction and raise</label>
      <textarea
        id="analyzer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={4000}
        placeholder="e.g. Seed-stage B2B SaaS, $18k MRR growing 12% MoM, 2 technical founders, raising $1.5M. We have a data room but no formal financial model yet…"
        className="w-full rounded-xl border border-site-line bg-white px-4 py-3 text-sm text-site-ink outline-none focus:border-site-blue-hi"
      />
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" onClick={analyze} disabled={busy} className="rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">
          {busy ? "Analyzing…" : cta}
        </button>
      </div>

      {note ? <p className="mt-4 rounded-lg bg-site-amber/10 px-4 py-3 text-center text-[13px] text-site-amber" role="status">{note}</p> : null}

      {result ? (
        <div className="mt-6 rounded-2xl border border-site-line bg-white p-6" role="status" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-5">
            {DIMENSIONS.map((d) => (
              <div key={d.key} className="text-center">
                <div className="font-site-display text-3xl font-extrabold text-site-blue">{result[d.key] as number}</div>
                <div className="font-site-mono text-[11px] uppercase tracking-wide text-site-muted">{d.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-site-line pt-4 text-sm leading-6 text-site-ink">{result.summary}</p>
          {result.fixes.length > 0 ? (
            <div className="mt-4">
              <div className="font-site-mono text-[11px] uppercase tracking-wide text-site-muted">Fix these first</div>
              <ul className="mt-2 space-y-2">
                {result.fixes.map((f, i) => (
                  <li key={i} className="rounded-lg bg-site-paper px-3 py-2 text-[13px] leading-6 text-site-ink"><span className="font-semibold text-site-navy">{f.area}:</span> {f.action}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-center text-[12px] leading-5 text-site-muted/80">{disclaimer}</p>
    </div>
  );
}
