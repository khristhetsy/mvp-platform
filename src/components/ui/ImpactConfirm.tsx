"use client";

import { useState } from "react";
import { useDismiss } from "@/lib/ui/use-dismiss";

export type ImpactLine = {
  /** The number that makes the consequence concrete. Null renders as a dash. */
  count: number | null;
  text: string;
  /** Dimmed — a fact worth stating that isn't a consequence. */
  benign?: boolean;
};

/**
 * Confirmation for an action whose consequences reach past the record being
 * edited.
 *
 * "Are you sure?" tells nobody anything. This states what is already pointing
 * at the thing being changed — how many registrations hold the old date, how
 * many people are watching the session about to end — so the decision is made
 * on facts rather than nerve.
 *
 * `confirmText` makes it type-to-confirm. Reserved for what can't be undone:
 * a date can be moved back, a live session can't be un-ended.
 */
export function ImpactConfirm({
  open,
  tone = "warn",
  title,
  subtitle,
  lines,
  loading,
  note,
  confirmText,
  confirmLabel,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  tone?: "warn" | "danger";
  title: string;
  subtitle?: string;
  lines: ImpactLine[];
  /** Counts still being read — shown as dashes rather than zeros. */
  loading?: boolean;
  note?: string;
  confirmText?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const ref = useDismiss<HTMLDivElement>(open, onCancel);

  if (!open) return null;
  // Keyed on `open` so the typed confirmation is genuinely fresh each time,
  // rather than cleared by an effect that runs a render too late.
  return <ImpactConfirmBody {...{ ref, tone, title, subtitle, lines, loading, note, confirmText, confirmLabel, onConfirm, onCancel }} />;
}

function ImpactConfirmBody({
  ref, tone, title, subtitle, lines, loading, note, confirmText, confirmLabel, onConfirm, onCancel,
}: Readonly<{
  ref: React.RefObject<HTMLDivElement | null>;
  tone: "warn" | "danger";
  title: string;
  subtitle?: string;
  lines: ImpactLine[];
  loading?: boolean;
  note?: string;
  confirmText?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const [typed, setTyped] = useState("");

  const danger = tone === "danger";
  // A zero count is never a reason to confirm — an impact line that says "0
  // recordings uploaded" is exactly the one worth reading.
  const armed = !confirmText || typed.trim() === confirmText.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 p-4 pt-[12vh]">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className="w-full max-w-[470px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white shadow-2xl">
        <div className="flex items-start gap-2.5 border-b border-slate-100 px-4 py-3">
          <span aria-hidden className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md border text-sm ${
            danger ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            {danger ? "✕" : "!"}
          </span>
          <span className="min-w-0">
            <b className="block text-[14px] text-[var(--navy)]">{title}</b>
            {subtitle ? <span className="block text-[11.6px] text-[var(--text-muted)]">{subtitle}</span> : null}
          </span>
        </div>

        <div className="px-4 py-3">
          <ul className="m-0 list-none p-0">
            {lines.map((l) => (
              <li key={l.text} className="flex items-start gap-2 border-b border-slate-50 py-1.5 last:border-b-0">
                <span className={`min-w-[26px] flex-none text-right text-[11.6px] font-extrabold ${
                  l.benign ? "text-slate-300" : "text-[var(--navy)]"
                }`}>
                  {loading ? "—" : l.count ?? "—"}
                </span>
                <span className={`text-[12.4px] ${l.benign ? "text-slate-400" : "text-[var(--text-secondary)]"}`}>
                  {l.text}
                </span>
              </li>
            ))}
          </ul>

          {note ? <p className="mt-2.5 text-[11.6px] text-[var(--text-muted)]">{note}</p> : null}

          {confirmText ? (
            <>
              <p className="mb-1.5 mt-3 text-[11.6px] text-[var(--text-muted)]">
                This can&rsquo;t be undone. Type the name to confirm:
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmText}
                aria-label="Type the name to confirm"
                className="w-full rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[12.2px]"
              />
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <span className="flex-1" />
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={!armed}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${
              danger ? "bg-red-700" : "bg-[var(--navy)]"
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
