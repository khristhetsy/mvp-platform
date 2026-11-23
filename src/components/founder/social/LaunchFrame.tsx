"use client";

import type { ReactNode } from "react";
import { btn, btnPrimary, card } from "@/components/founder/social/FounderSocialShared";

/** Numbered progress for a wizard. Finished steps show a check, the current one is filled. */
export function Stepper({ labels, step }: { labels: string[]; step: number }) {
  return (
    <ol className="mb-4 flex gap-1 overflow-x-auto" aria-label="Steps">
      {labels.map((l, i) => {
        const done = i < step;
        const cur = i === step;
        return (
          <li key={l} className="min-w-[72px] flex-1 text-center" aria-current={cur ? "step" : undefined}>
            <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${done ? "border-emerald-600 bg-emerald-600 text-white" : cur ? "border-[#1A6CE4] bg-[#1A6CE4] text-white" : "border-slate-300 bg-white text-slate-500"}`}>
              {done ? "✓" : i + 1}
            </span>
            <span className={`mt-1 block text-[11px] ${cur ? "font-semibold text-[#1A6CE4]" : "text-slate-500"}`}>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Shared shell for every Launch my social media wizard: title, stepper, the current step,
 * and a Back and Next footer. The wizard decides what Next does and when it is allowed.
 */
export function WizardFrame({ title, part, labels, step, onBack, onNext, nextLabel = "Next", nextDisabled = false, hideNext = false, busy = false, onExit, exitLabel = "Back to home", extraFooter, children }: {
  title: string; part: string; labels: string[]; step: number;
  onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; hideNext?: boolean; busy?: boolean;
  onExit: () => void; exitLabel?: string; extraFooter?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <button type="button" className="mb-2 text-xs font-medium text-slate-500 hover:text-slate-800" onClick={onExit}>← {exitLabel}</button>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">{part}</span>
      </div>
      <div className="mt-3"><Stepper labels={labels} step={step} /></div>
      <div className={card}>
        {children}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="button" className={btn} disabled={step === 0 || busy} onClick={onBack}>Back</button>
          {extraFooter}
          <span className="ml-auto text-xs text-slate-500">Step {step + 1} of {labels.length}</span>
          {!hideNext && <button type="button" className={btnPrimary} disabled={nextDisabled || busy} onClick={onNext}>{busy ? "Working…" : nextLabel}</button>}
        </div>
      </div>
    </div>
  );
}

/** The finished screen every wizard ends on. */
export function DoneCard({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center" role="status">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700" aria-hidden="true">✓</div>
      <h2 className="mt-3 text-lg font-semibold text-slate-900">{title}</h2>
      {body && <p className="mt-1 text-sm text-slate-600">{body}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
  );
}
