"use client";

// F1 — horizontal mailbox switcher as an ARIA tablist. Active tab is distinct by
// fill + border + weight (not color alone). Arrow keys move between tabs;
// overflow scrolls horizontally. Pure index math lives in ./tablist.ts.

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Inbox as InboxIcon, Mail } from "lucide-react";
import type { Mailbox } from "./types";
import { isTabNavKey, nextTabIndex } from "./tablist";

const ICONS: Record<string, typeof Mail> = { capitalos: InboxIcon, gmail: Mail };

export interface MailboxTabsProps {
  mailboxes: Mailbox[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function MailboxTabs({ mailboxes, activeId, onSelect }: MailboxTabsProps) {
  const t = useTranslations("sharedCmp");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (mailboxes.length === 0) return null;

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!isTabNavKey(e.key)) return;
    e.preventDefault();
    const next = nextTabIndex(index, e.key, mailboxes.length);
    const el = tabRefs.current[next];
    el?.focus();
    onSelect(mailboxes[next].id);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("mailboxes")}</span>
      <div role="tablist" aria-label="Mailboxes" className="flex gap-2 overflow-x-auto">
        {mailboxes.map((m, i) => {
          const Icon = ICONS[m.id] ?? Mail;
          const active = m.id === activeId;
          return (
            <button
              key={m.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(m.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#185FA5] ${
                active
                  ? "border border-[#0c1826] bg-[#0c1826] font-semibold text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden /> {m.label}
              {m.unreadCount ? <span className={`text-[11px] ${active ? "text-white/80" : "text-slate-400"}`}>{m.unreadCount}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
