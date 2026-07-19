"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Shared read-only "Preview" modal for Raise Toolkit modules (business plan,
 * financial model, cap table, Reg CF). Shows a rendered view of the current
 * deliverable — no edits are saved from here.
 */
export function FounderModulePreview({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: Readonly<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}>) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--indigo)]">
              Preview · read-only
            </div>
            <h3 className="text-base font-semibold text-[var(--navy)]">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="border-t border-slate-200 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Consistent "Preview" action button used across the Raise Toolkit modules. */
export function PreviewButton({
  onClick,
  label = "Preview",
}: Readonly<{ onClick: () => void; label?: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--navy)] bg-[var(--navy)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      {label}
    </button>
  );
}
