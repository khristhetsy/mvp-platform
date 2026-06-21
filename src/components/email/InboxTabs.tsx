"use client";

import { useState } from "react";
import { Inbox as InboxIcon, Mail } from "lucide-react";
import { EmailInbox } from "./EmailInbox";
import { GmailInbox } from "./GmailInbox";

/** Inbox shell: a left source rail (CapitalOS vs Gmail), content on the right. */
export function InboxTabs() {
  const [tab, setTab] = useState<"capitalos" | "gmail">("capitalos");

  const item = (id: "capitalos" | "gmail", label: string, Icon: typeof Mail) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === id ? "bg-[#E6F1FB] text-[#0C447C]" : "text-slate-600 hover:bg-slate-100"}`}
    >
      <Icon className="h-4 w-4 shrink-0" /> {label}
    </button>
  );

  return (
    <div className="flex gap-4">
      <nav className="w-36 shrink-0 space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mailboxes</p>
        {item("capitalos", "CapitalOS", InboxIcon)}
        {item("gmail", "Gmail", Mail)}
      </nav>
      <div className="min-w-0 flex-1">
        {tab === "capitalos" ? <EmailInbox /> : <GmailInbox />}
      </div>
    </div>
  );
}
