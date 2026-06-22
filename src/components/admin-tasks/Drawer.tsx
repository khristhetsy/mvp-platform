"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Right-side slide-over. Esc closes; backdrop click closes; respects
// prefers-reduced-motion (transition utilities are skipped by the browser when
// the user opts out, and we keep motion minimal).
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl motion-safe:animate-[slidein_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-[#0F2147]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
