"use client";

/**
 * A locked match on the founder's match list. Tapping it opens a panel with the
 * two ways to see it: a plan, or a free match review. Receives only the
 * "matched on" line, never an identity.
 */
import { useState } from "react";

export function LockedMatchRow({ token, line, matchCount }: { token: string; line: string; matchCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left last:border-b-0 hover:bg-slate-100">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400" aria-hidden="true"><i className="ti ti-lock" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-slate-400">Locked match</span>
          <span className="block truncate text-[12px] text-slate-500">{line}</span>
        </span>
        <i className="ti ti-chevron-right text-slate-400" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" role="dialog" aria-modal="true" aria-label="Locked match" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-semibold text-site-navy"><i className="ti ti-lock" aria-hidden="true" /> Locked match</p>
            <p className="mb-4 mt-1 text-[13px] text-slate-500">Matched on {line}. See who it is, their contact details, and request an introduction with a plan.</p>
            <a href={`/mc/${token}?a=intro`} className="block rounded-lg border border-site-blue px-5 py-3 text-center text-sm font-semibold text-site-blue hover:bg-slate-50">Choose a plan to unlock</a>
            <p className="mb-2 mt-4 text-[12px] text-slate-500">Or we&apos;ll cover all {matchCount} on a free match review:</p>
            <a href={`/mc/${token}?a=call`} className="block rounded-lg bg-site-blue px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90">Pick a time for your match review</a>
            <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full text-center text-[13px] text-slate-500 hover:underline">Close</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
