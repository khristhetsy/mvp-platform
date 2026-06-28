"use client";

import { useState } from "react";
import { EmailInbox } from "./EmailInbox";
import { GmailInbox } from "./GmailInbox";
import { MailboxTabs } from "./MailboxTabs";
import type { Mailbox } from "./types";

const MAILBOXES: Mailbox[] = [
  { id: "capitalos", label: "iCapOS" },
  { id: "gmail", label: "Gmail" },
];

/** Inbox shell: a horizontal mailbox switcher (F1) on top, content below. */
export function InboxTabs() {
  const [tab, setTab] = useState<"capitalos" | "gmail">("capitalos");

  return (
    <div className="space-y-3">
      <MailboxTabs mailboxes={MAILBOXES} activeId={tab} onSelect={(id) => setTab(id as "capitalos" | "gmail")} />
      <div className="min-w-0">
        {tab === "capitalos" ? <EmailInbox /> : <GmailInbox />}
      </div>
    </div>
  );
}
