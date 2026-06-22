"use client";

// F2 — message-header sender block: display name as a button + inline email,
// with the anchored ContactCard. Controlled by the parent (single-open via
// `open`/`onToggle`) so at most one card is open across the message list.

import { useRef } from "react";
import type { Sender } from "./types";
import { ContactCard } from "./ContactCard";

export interface SenderHeaderProps {
  sender: Sender;
  date: string;
  security?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEmail: (sender: Sender) => void;
  onAddContact: (sender: Sender) => void;
}

export function SenderHeader({ sender, date, security, open, onToggle, onClose, onEmail, onAddContact }: SenderHeaderProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasEmail = Boolean(sender.email);

  return (
    <span className="relative inline-flex max-w-full items-baseline gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="truncate text-sm font-semibold text-slate-900 hover:text-[#185FA5] focus:outline-none focus-visible:underline"
        title={sender.name || sender.email}
      >
        {sender.name || sender.email}
      </button>
      {hasEmail && sender.name ? (
        <span className="truncate text-xs text-slate-400" title={sender.email}>&lt;{sender.email}&gt;</span>
      ) : null}

      <ContactCard
        sender={sender}
        date={date}
        security={security}
        open={open}
        triggerRef={triggerRef}
        onClose={onClose}
        onEmail={onEmail}
        onAddContact={onAddContact}
      />
    </span>
  );
}
