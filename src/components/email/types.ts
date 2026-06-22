// UI-layer types for the inbox presentational components (MailboxTabs,
// SenderHeader, ContactCard, ComposeModal). Data-layer types stay in
// src/lib/email/inbox.ts and src/lib/email/drafts.ts.

import type { EmailAttachment } from "@/lib/email/inbox";
import type { ComposePrefill, ComposeMode } from "@/lib/email/compose-prefill";

export type { ComposePrefill, ComposeMode };

export interface Mailbox {
  id: string; // "capitalos" | "gmail" | ...
  label: string;
  unreadCount?: number;
}

export interface Sender {
  name: string;
  email: string;
  replyTo?: string;
  verified?: boolean;
  avatarUrl?: string;
}

/** What the compose modal sends back up to the existing send pipeline. */
export interface ComposeDraft {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
}
