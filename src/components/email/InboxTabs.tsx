"use client";

import { useState } from "react";
import { Inbox as InboxIcon, Mail } from "lucide-react";
import { EmailInbox } from "./EmailInbox";
import { GmailInbox } from "./GmailInbox";

/** Inbox shell: switch between the in-platform CapitalOS inbox and the user's Gmail. */
export function InboxTabs() {
  const [tab, setTab] = useState<"capitalos" | "gmail">("capitalos");
  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-full bg-slate-100 p-1">
        <button type="button" onClick={() => setTab("capitalos")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${tab === "capitalos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          <InboxIcon className="h-4 w-4" /> CapitalOS
        </button>
        <button type="button" onClick={() => setTab("gmail")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${tab === "gmail" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          <Mail className="h-4 w-4" /> Gmail
        </button>
      </div>
      {tab === "capitalos" ? <EmailInbox /> : <GmailInbox />}
    </div>
  );
}
