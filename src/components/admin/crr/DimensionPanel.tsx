"use client";

/**
 * One CRR dimension, opened from a card on the Companies tab.
 *
 * Four parts: what the dimension is worth for THIS company at THIS stage, the
 * factors inside it, what to do about it, and the evidence the scorer read.
 *
 * The point gains next to each suggestion are computed server-side from the
 * factor scores and the active weighting — they are never written by the AI.
 */
import { useCallback, useEffect, useState } from "react";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";
import type { Dimension } from "@/lib/crr/profiles";
import type { DimensionDetail, Gap } from "@/lib/crr/dimension-detail";

type AdviceItem = { title: string; detail: string; factor: FactorKey | null; gain: number };
type Payload = {
  company: string;
  companyId: string;
  profileLabel: string;
  version: string;
  detail: DimensionDetail;
  gaps: Gap[];
  advice: { source: "ai" | "flags"; generatedAt: string; items: AdviceItem[] };
  evidence: Array<{ icon: "pass" | "warn" | "fail"; text: string; src: string; factor: FactorKey; factorLabel: string }>;
  factorScores: Record<string, FactorScore | null>;
};

const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnPri = "rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const sect = "mb-1.5 mt-5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400";
const EV = { pass: { ch: "✓", cl: "text-emerald-600" }, warn: { ch: "!", cl: "text-amber-600" }, fail: { ch: "✕", cl: "text-rose-600" } };
const colorFor = (n: number) => (n >= 75 ? "#1D9E75" : n >= 45 ? "#E8922A" : "#D9534F");

export function DimensionPanel({
  companyId,
  dimension,
  onClose,
  onOpenFactor,
}: {
  companyId: string;
  dimension: Dimension;
  onClose: () => void;
  /** Hands off to the existing factor popup — one level deeper. */
  onOpenFactor: (key: FactorKey, score: FactorScore) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (action?: "regenerate") => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/crr/dimension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, dimension, action }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't load this dimension."); return; }
    setData(j);
  }, [companyId, dimension]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function send() {
    setBusy(true);
    const r = await fetch("/api/admin/crr/dimension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, dimension, action: "send" }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't send that."); return; }
    setNotice("Sent to the founder — the suggestions only, not the score.");
  }

  function copy() {
    if (!data) return;
    const text = data.advice.items.map((i, n) => `${n + 1}. ${i.title}\n   ${i.detail}`).join("\n\n");
    void navigator.clipboard?.writeText(text).then(
      () => setNotice("Copied."),
      () => setError("Couldn't reach the clipboard."),
    );
  }

  const d = data?.detail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo-600">
              {d?.label ?? "Dimension"}{data ? ` · ${data.company}` : ""}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold" style={{ color: colorFor(d?.score ?? 0) }}>{d?.score ?? "—"}</span>
              <span className="text-sm text-slate-400">/ 100</span>
              {data ? <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{data.profileLabel} profile</span> : null}
            </div>
          </div>
          <div className="flex gap-1.5">
            <a href={`/admin/companies/${companyId}`} className={btn} target="_blank" rel="noreferrer">Open company ↗</a>
            <button type="button" onClick={onClose} className={btn} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error ? <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
          {notice ? <div className="mb-3 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800"><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice(null)}>✕</button></div> : null}

          {!data ? (
            <p className="py-8 text-center text-[13px] text-slate-400">{busy ? "Reading the score…" : "Nothing to show."}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-5 rounded-xl bg-slate-50 px-4 py-3 text-[11.5px]">
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">Weight · {data.profileLabel}</span>
                  <b className="text-[13px] tabular-nums">{d!.weight}</b>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">Contributes now</span>
                  <b className="text-[13px] tabular-nums">{d!.contributes} pts</b>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">If it hit {d!.target}</span>
                  <b className="text-[13px] tabular-nums text-emerald-700">+{d!.gainAtTarget} pts</b>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">Company score</span>
                  <b className="text-[13px] tabular-nums">{d!.scoreNow} → <span className="text-emerald-700">{d!.scoreAtTarget}</span></b>
                </div>
              </div>

              <p className={sect}>
                {d!.factors.length === 1 ? "The factor inside" : `The ${d!.factors.length} factors inside`} {d!.label}
              </p>
              {d!.factors.map((f) => {
                const fs = data.factorScores[f.key];
                const pct = f.max > 0 ? (f.pts / f.max) * 100 : 0;
                return (
                  <button
                    key={f.key}
                    type="button"
                    disabled={!fs}
                    onClick={() => fs && onOpenFactor(f.key, fs)}
                    className="flex w-full items-center gap-3 border-b border-slate-50 py-2 text-left text-[12.5px] hover:bg-slate-50/70 disabled:cursor-default"
                  >
                    <span className="flex-1 text-slate-700">{f.label}</span>
                    <span className="h-[5px] w-[120px] overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: colorFor(pct) }} />
                    </span>
                    <span className="w-[52px] text-right font-semibold tabular-nums" style={{ color: colorFor(pct) }}>
                      {f.pts}/{f.max}
                    </span>
                    <span className="text-slate-300">›</span>
                  </button>
                );
              })}
              <p className="mt-1.5 text-[11px] text-slate-400">
                {d!.pts} of {d!.ptsMax} pts → {d!.score}. Click a factor for its sub-scores, evidence and flags.
              </p>

              <p className={sect}>Suggested improvements</p>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-indigo-600">
                  <span aria-hidden="true">✦</span>
                  {data.advice.source === "ai" ? "AI suggestion" : "From the scorer's flags"}
                  <span className="ml-auto text-[10.5px] font-normal normal-case tracking-normal text-slate-400">
                    {data.advice.source === "flags" ? "AI unavailable — showing the flagged gaps" : new Date(data.advice.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>

                {data.advice.items.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-slate-500">Nothing to improve here — this dimension is at full marks.</p>
                ) : (
                  <div className="mt-2">
                    {data.advice.items.map((i, n) => (
                      <div key={n} className="flex gap-2.5 border-b border-indigo-100/70 py-2 last:border-0 last:pb-0">
                        <span className="mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10.5px] font-semibold text-white">{n + 1}</span>
                        <div className="text-[12.5px] leading-relaxed text-slate-700">
                          <b>{i.title}</b> {i.detail}
                          {i.gain > 0 ? (
                            <div className="mt-1">
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">+{i.gain} to the score</span>
                              {n === 0 ? <span className="ml-1.5 text-[11px] text-slate-400">largest single gain available</span> : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button type="button" className={btnPri} disabled={busy || !data.advice.items.length} onClick={send}>Send to founder</button>
                  <button type="button" className={btn} disabled={!data.advice.items.length} onClick={copy}>Copy</button>
                  <button type="button" className={btn} disabled={busy} onClick={() => void load("regenerate")}>Regenerate</button>
                  <span className="ml-auto text-[10.5px] text-slate-400">Generated, not verified — read it before sending.</span>
                </div>
              </div>

              {data.evidence.length > 0 && (
                <>
                  <p className={sect}>What the scorer read</p>
                  {data.evidence.map((e, n) => (
                    <div key={n} className="flex gap-2 py-1 text-[12px] text-slate-600">
                      <span className={`w-4 shrink-0 text-center font-bold ${EV[e.icon].cl}`}>{EV[e.icon].ch}</span>
                      <span>{e.text} <span className="text-slate-400">· {e.src}</span></span>
                    </div>
                  ))}
                </>
              )}

              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
                <b>Founders cannot see their score.</b> &ldquo;Send to founder&rdquo; delivers the suggestions only — never the score, the band or the weighting.
              </p>
              <p className="mt-2 text-[10.5px] text-slate-400">
                Computed against weight set {data.version}. Change the weights and these figures move with them.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
