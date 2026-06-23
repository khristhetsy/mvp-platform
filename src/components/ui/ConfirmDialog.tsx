"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

// Imperative bridge: the mounted provider registers an opener; callers anywhere
// invoke confirmDialog() and await the boolean result.
let opener: ((o: ConfirmOptions) => Promise<boolean>) | null = null;

/** Show a branded confirmation modal. Falls back to native confirm if unmounted. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (opener) return opener(options);
  if (typeof window !== "undefined") return Promise.resolve(window.confirm(options.message));
  return Promise.resolve(false);
}

/** Mount once near the app root (inside ToastProvider). */
export function ConfirmProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<{ opts: ConfirmOptions } | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  useEffect(() => {
    opener = (o) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setState({ opts: o });
      });
    return () => { opener = null; };
  }, []);

  const settle = (v: boolean) => {
    resolveRef.current?.(v);
    resolveRef.current = null;
    setState(null);
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") settle(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  return (
    <>
      {children}
      {state ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={() => settle(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${state.opts.danger ? "bg-[#FCEBEB] text-[#A32D2D]" : "bg-[#E6F1FB] text-[#0C447C]"}`}>
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p id="confirm-title" className="text-sm font-semibold text-slate-950">{state.opts.title ?? "Are you sure?"}</p>
                <p className="mt-1 text-sm text-slate-600">{state.opts.message}</p>
              </div>
              <button type="button" onClick={() => settle(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => settle(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {state.opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${state.opts.danger ? "bg-[#A32D2D] hover:bg-[#791F1F]" : "bg-slate-900 hover:bg-slate-800"}`}
              >
                {state.opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
