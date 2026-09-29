"use client";

import { useState } from "react";
import { ScoreRing } from "@/components/ui/ScoreRing";
import type { ItemDiagnosis } from "@/lib/admin/stage-diagnosis";

/**
 * The expandable half of a stage-menu row: what is wrong, what is missing, and
 * how to fix it.
 *
 * The row itself is unchanged — same icon, label, chip and Open controls. This
 * only adds the caret and the drawer beneath, because a bare "Attention" chip
 * told staff nothing they could act on.
 */
export function StageItemDrawer({
  diagnosis,
  actions,
  children,
}: Readonly<{
  diagnosis: ItemDiagnosis | null;
  /** Trailing row controls — never inside the toggle button. */
  /** Trailing controls for the row, kept outside the toggle button. Optional —
   *  rows currently have none since "Open as founder" was removed. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);

  // No diagnosis for this route: the row renders exactly as before, no caret.
  if (!diagnosis) {
    return (
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        {children}
        {actions}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {children}
          <i
            className={`ti ${open ? "ti-chevron-down" : "ti-chevron-right"} text-[13px] text-slate-300`}
            aria-hidden="true"
          />
        </button>
        {actions}
      </div>

      {open ? (
        <div className="border-t border-dashed border-slate-200 bg-slate-50/60 px-3.5 pb-4 pl-11 pt-1">
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
            {/* ---- the problem ---- */}
            <Block tone="red" title="The problem">
              {diagnosis.ring ? (
                <div className="mb-2 flex items-center gap-3">
                  <ScoreRing
                    score={diagnosis.ring.score}
                    size={64}
                    sublabel="CRR"
                    title={`CRR ${diagnosis.ring.score} of 100, gate at ${diagnosis.ring.gate}`}
                  />
                  <span className="text-[11.5px] leading-relaxed text-slate-600">
                    {diagnosis.ring.label} profile
                    {diagnosis.ring.band ? (
                      <>
                        {" · band "}
                        <b className="text-slate-900">{diagnosis.ring.band}</b>
                      </>
                    ) : null}
                    <br />
                    gate <b className="tabular-nums text-slate-900">{diagnosis.ring.gate}</b>
                    {diagnosis.ring.score < diagnosis.ring.gate ? (
                      <>
                        {" · "}
                        <b className="tabular-nums text-red-600">{diagnosis.ring.gate - diagnosis.ring.score}</b> short
                      </>
                    ) : (
                      " · cleared"
                    )}
                  </span>
                </div>
              ) : null}
              {diagnosis.problem.map((line) => (
                <p key={line} className="mb-1.5 text-[12.5px] leading-relaxed text-slate-600 last:mb-0">
                  {line}
                </p>
              ))}
            </Block>

            {/* ---- what's missing ---- */}
            <Block tone="amber" title="What's missing">
              {diagnosis.missing.length === 0 ? (
                <p className="text-[12.5px] text-slate-500">Nothing outstanding on this item.</p>
              ) : (
                diagnosis.missing.map((m) =>
                  m.bar ? (
                    <div key={m.label} className="mb-2 last:mb-0">
                      <div className="mb-1 flex justify-between text-[11.5px] text-slate-600">
                        <span>{m.label}</span>
                        <span>
                          <b className="tabular-nums text-slate-900">{m.bar.value}</b>/{m.bar.max}{" "}
                          <span className="font-semibold tabular-nums text-red-600">{m.note}</span>
                        </span>
                      </div>
                      <div className="h-[7px] overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${barTone(m.bar.value, m.bar.max)}`}
                          style={{ width: `${m.bar.max > 0 ? Math.round((m.bar.value / m.bar.max) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={m.label}
                      className="flex justify-between gap-3 border-b border-slate-100 py-1 text-[12.5px] text-slate-600 last:border-b-0"
                    >
                      <span>{m.label}</span>
                      <span className="whitespace-nowrap font-semibold text-red-600">{m.note}</span>
                    </div>
                  ),
                )
              )}
            </Block>

            {/* ---- how to solve ---- */}
            <Block tone="green" title="How to solve">
              {diagnosis.fixes.map((f, i) => (
                <div
                  key={f.text}
                  className="flex items-start gap-2 border-b border-slate-100 py-1.5 last:border-b-0"
                >
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-indigo-50 text-[9.5px] font-bold text-indigo-600">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[12.5px] leading-relaxed text-slate-600">
                    {f.text}
                    {f.who ? <span className="mt-0.5 block text-[10.5px] text-slate-400">{f.who}</span> : null}
                  </span>
                  {f.impact ? (
                    <span className="whitespace-nowrap text-[12px] font-bold tabular-nums text-emerald-600">
                      {f.impact}
                    </span>
                  ) : null}
                </div>
              ))}
            </Block>
          </div>

          <p className="mt-2.5 text-[10.5px] text-slate-400">Source: {diagnosis.source}</p>
        </div>
      ) : null}
    </>
  );
}

function barTone(value: number, max: number): string {
  const pct = max > 0 ? value / max : 0;
  if (pct >= 0.6) return "bg-emerald-600";
  if (pct >= 0.3) return "bg-amber-600";
  return "bg-red-600";
}

function Block({
  tone,
  title,
  children,
}: Readonly<{ tone: "red" | "amber" | "green"; title: string; children: React.ReactNode }>) {
  const head = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-emerald-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h4 className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${head}`}>{title}</h4>
      {children}
    </div>
  );
}
