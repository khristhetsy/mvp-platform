"use client";

import Link from "next/link";
import { X, Lock } from "lucide-react";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useDismiss } from "@/lib/ui/use-dismiss";
import type { SampleDeal } from "@/lib/marketplace/sample-board";

const BAND_LABEL = { high: "Strong", mid: "Moderate", low: "Building" } as const;

/** What an approved investor sees once access is granted. Locked here, never invented. */
const AFTER_ACCESS = ["Company overview", "Team", "Traction", "Financials", "Data room"];

/**
 * Company one pager for a row on the public Private Market board. The board is
 * illustrative, so this shows only what the row itself carries and says so.
 */
export function DealOnePagerDrawer({
  deal,
  onClose,
}: Readonly<{ deal: SampleDeal | null; onClose: () => void }>) {
  const ref = useDismiss<HTMLDivElement>(deal !== null, onClose);
  if (!deal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/45"
      role="dialog"
      aria-modal="true"
      aria-label={`${deal.name} one pager`}
    >
      <div ref={ref} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">Company one pager · Sample</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--navy)]">{deal.name}</h2>
            <p className="mt-1 font-mono text-[12px] font-semibold text-slate-600">{deal.symbol}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {deal.tags.map((t) => (
                <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10.5px] text-slate-600">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close one pager"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <ScoreRing score={deal.score} size={88} title={`Readiness ${deal.score.toFixed(1)} out of 100`} />
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500">Readiness</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[var(--navy)]">{deal.score.toFixed(1)}</p>
              <p className="font-mono text-[11px] text-slate-500">{BAND_LABEL[deal.band]}</p>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500">Indicated interest</p>
              <p className="font-mono text-[13px] font-semibold text-[var(--navy)]">{deal.indicatedPct}% indicated</p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={deal.indicatedPct}
              aria-label="Share of target indicated"
            >
              <div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${deal.indicatedPct}%` }} />
            </div>
            <p className="mt-2 font-mono text-[12px] text-slate-600">
              {deal.indicatedAmount} of {deal.targetAmount} target
            </p>
          </div>

          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500">After access is approved</p>
            <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              {AFTER_ACCESS.map((s) => (
                <li key={s} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0">
                  <span>{s}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Approved investors
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/auth/sign-up" className="cap-btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
              Request access
            </Link>
            <Link href="/investors" className="cap-btn-secondary inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
              How it works →
            </Link>
          </div>

          <p className="font-mono text-[10px] leading-relaxed text-slate-500">
            Illustrative sample. Figures are not live platform data. Shown for informational purposes only and not an investment recommendation.
          </p>
        </div>
      </div>
    </div>
  );
}
