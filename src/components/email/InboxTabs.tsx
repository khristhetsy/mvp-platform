"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmailInbox } from "./EmailInbox";
import { GmailInbox } from "./GmailInbox";
import { LinkedInInbox } from "@/components/admin/linkedin/LinkedInInbox";
import { MailboxTabs } from "./MailboxTabs";
import type { Mailbox } from "./types";

const MAILBOXES: Mailbox[] = [
  { id: "capitalos", label: "iCapOS" },
  { id: "gmail", label: "Gmail" },
  { id: "linkedin", label: "LinkedIn" },
];

/** Inbox shell: a horizontal mailbox switcher (F1) on top, content below.
 *  `gmailOnly` (founder / investor) drops the iCapOS mailbox entirely. */
export function InboxTabs({ gmailOnly = false }: { gmailOnly?: boolean }) {
  const searchParams = useSearchParams();
  const mailboxes = gmailOnly ? MAILBOXES.filter((m) => m.id === "gmail") : MAILBOXES; // LinkedIn is admin only, like the iCapOS mailbox
  // "Email" buttons across the app deep-link here with ?compose=1 to open the Gmail
  // compose in-platform (instead of leaving for mail.google.com).
  const [tab, setTab] = useState<"capitalos" | "gmail" | "linkedin">(gmailOnly || searchParams?.get("compose") ? "gmail" : "capitalos");

  return (
    <div className="space-y-3">
      <MailboxTabs mailboxes={mailboxes} activeId={tab} onSelect={(id) => setTab(id as "capitalos" | "gmail" | "linkedin")} />
      <div className="min-w-0">
        {tab === "linkedin" && !gmailOnly ? <LinkedInInbox /> : tab === "capitalos" && !gmailOnly ? <EmailInbox /> : <GmailInbox />}
      </div>
    </div>
  );
}
