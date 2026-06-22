"use client";

// F2 — contact card popover anchored to the sender name. Closes on outside
// click, Escape, or a second trigger click (handled by the parent toggling
// `open`). Focus is trapped while open and restored to the trigger on close.

import { useRef } from "react";
import { Mail, UserPlus, ShieldCheck } from "lucide-react";
import type { Sender } from "./types";
import { useFocusTrap, useOnEscape, useOutsideClick } from "./a11y";

function initials(name: string, email: string): string {
  const base = name?.trim() || email;
  return base.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

export interface ContactCardProps {
  sender: Sender;
  date: string;
  security?: string;
  open: boolean;
  /** Ref of the trigger button, so outside-click ignores clicks on the trigger. */
  triggerRef: { readonly current: HTMLElement | null };
  onClose: () => void;
  onEmail: (sender: Sender) => void;
  onAddContact: (sender: Sender) => void;
}

export function ContactCard({ sender, date, security, open, triggerRef, onClose, onEmail, onAddContact }: ContactCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useOnEscape(open, onClose);
  useOutsideClick(open, [cardRef, triggerRef], onClose);
  useFocusTrap(open, cardRef);

  if (!open) return null;

  const when = (() => {
    const d = new Date(date);
    return Number.isNaN(d.getTime())
      ? date
      : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  })();

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Contact: ${sender.name || sender.email}`}
      className="absolute left-0 top-full z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)] outline-none"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-sm font-semibold text-[#0C447C]">
          {initials(sender.name, sender.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-slate-950" title={sender.name || sender.email}>
            {sender.name || sender.email}
            {sender.verified ? <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#185FA5]" aria-label="Verified" /> : null}
          </p>
          {sender.email ? (
            <a href={`mailto:${sender.email}`} className="block truncate text-xs text-slate-500 hover:text-[#185FA5]" title={sender.email}>{sender.email}</a>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        {sender.replyTo && sender.replyTo.toLowerCase() !== sender.email.toLowerCase() ? (
          <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-400">Reply-to</dt><dd className="min-w-0 flex-1 truncate text-slate-700" title={sender.replyTo}>{sender.replyTo}</dd></div>
        ) : null}
        <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-400">Date</dt><dd className="min-w-0 flex-1 text-slate-700">{when}</dd></div>
        {security ? (
          <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-400">Security</dt><dd className="min-w-0 flex-1 text-slate-700">{security}</dd></div>
        ) : null}
      </dl>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onEmail(sender)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <Mail className="h-3.5 w-3.5" /> Email
        </button>
        <button
          type="button"
          onClick={() => onAddContact(sender)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add contact
        </button>
      </div>
    </div>
  );
}
