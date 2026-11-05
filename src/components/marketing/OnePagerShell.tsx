"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useDismiss } from "@/lib/ui/use-dismiss";

/**
 * Slide-over frame shared by the company one pagers on the public deals page:
 * backdrop, dialog semantics, Escape and outside-click to close, header and close button.
 * Render it only while a one pager is open.
 */
export function OnePagerShell({
  ariaLabel,
  eyebrow,
  title,
  subtitle,
  tags = [],
  onClose,
  children,
}: Readonly<{
  ariaLabel: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  tags?: string[];
  onClose: () => void;
  children: ReactNode;
}>) {
  const ref = useDismiss<HTMLDivElement>(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div ref={ref} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-1.5 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--navy)]">{title}</h2>
            {subtitle ? <p className="mt-1 font-mono text-[12px] font-semibold text-slate-600">{subtitle}</p> : null}
            {tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10.5px] text-slate-600">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
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
        <div className="flex flex-col gap-6 px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
