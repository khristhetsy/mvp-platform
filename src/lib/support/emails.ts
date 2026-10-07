/**
 * Support emails, founder and staff, built on the one platform layout.
 *
 * Founder emails always name a person and a time, never a match score, and
 * never pretend a robot is working on it. Staff emails link straight to the
 * request in the queue. Sending goes through Resend only when it is
 * configured; the bell notice is sent separately, so a missing email key
 * never doubles a notice.
 */
import { renderEmail, NOT_A_BROKER_DEALER, type RenderedEmail } from "@/lib/email/layout";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { makeToken } from "@/lib/signed-links/tokens";
import { formatSupportTime } from "./business-hours";
import { founderSupportLink, staffSupportLink } from "./support";
import { supportReplyAddress, supportInboundEnabled } from "./inbound";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
const CONFIRM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SUPPORT_CONFIRM_ACTION = "confirm";

/** One-click "did this solve it?" link. Possession of the email is the authorization. */
export function supportConfirmUrl(requestId: string, answer: "yes" | "no"): string {
  const token = makeToken({ kind: "support", id: requestId, action: SUPPORT_CONFIRM_ACTION, expiresAt: Date.now() + CONFIRM_TTL_MS });
  return `${APP_URL}/support/confirm/${token}?a=${answer}`;
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";
const ref = (refNo: number | null | undefined) => (refNo ? `Request #${refNo}` : "Your request");
const clip = (s: string | null | undefined, n = 600) => {
  const t = (s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export type FounderEmailCtx = {
  requestId: string;
  refNo: number | null;
  subject: string;
  founderName: string | null;
  ownerName: string | null;
};

const founderFooter = {
  reason: "You're getting this because you asked iCapOS support for help.",
  lines: [NOT_A_BROKER_DEALER],
};

const owner = (c: FounderEmailCtx) => c.ownerName?.trim() || "Our team";

export function confirmationEmail(c: FounderEmailCtx, firstMessage: string | null, dueAt: string | null): RenderedEmail {
  const due = dueAt ? formatSupportTime(dueAt) : null;
  return renderEmail({
    audience: "founder",
    subject: `We received your request: ${c.subject}`,
    preheader: due ? `${owner(c)} will reply by ${due}.` : `${owner(c)} has your request.`,
    context: ref(c.refNo),
    headline: "We have your request",
    intro: `Hi ${firstName(c.founderName)}, thanks for reaching out. ${c.ownerName?.trim() ? `${c.ownerName.trim()} from our team is` : "Our team is"} handling your request${due ? ` and will reply by ${due}` : ""}.`,
    blocks: [
      ...(firstMessage ? [{ type: "quote" as const, label: "Your message", text: clip(firstMessage) }] : []),
      { type: "paragraph", text: "You can add details any time from your request page. We'll email you the moment there's a reply." },
    ],
    primary: { label: "View my request", url: `${APP_URL}${founderSupportLink(c.requestId)}` },
    footer: founderFooter,
  });
}

export function staffReplyEmail(c: FounderEmailCtx, body: string, attachmentNames: string[] = []): RenderedEmail {
  return renderEmail({
    audience: "founder",
    subject: `${owner(c)} replied: ${c.subject}`,
    preheader: clip(body, 120),
    context: ref(c.refNo),
    headline: `${owner(c)} replied to your request`,
    blocks: [
      { type: "quote", label: owner(c), text: clip(body, 1500) },
      ...(attachmentNames.length
        ? [{ type: "paragraph" as const, text: `Attached on your request page: ${attachmentNames.join(", ")}.` }]
        : []),
      ...(supportInboundEnabled() ? [{ type: "note" as const, text: "You can reply to this email, or reply from your request page." }] : []),
    ],
    primary: { label: "View and reply", url: `${APP_URL}${founderSupportLink(c.requestId)}` },
    footer: founderFooter,
  });
}

export function moreTimeEmail(c: FounderEmailCtx, newDueAt: string): RenderedEmail {
  const due = formatSupportTime(newDueAt);
  return renderEmail({
    audience: "founder",
    subject: `Update on your request: ${c.subject}`,
    preheader: `New reply time: ${due}.`,
    context: ref(c.refNo),
    headline: "An update on your request",
    intro: `Hi ${firstName(c.founderName)}, ${owner(c)} needs a bit more time to give you a proper answer. New reply time: ${due}. Sorry for the wait.`,
    primary: { label: "View my request", url: `${APP_URL}${founderSupportLink(c.requestId)}` },
    footer: founderFooter,
  });
}

export function waitingOnYouEmail(c: FounderEmailCtx, lastStaffMessage: string | null): RenderedEmail {
  return renderEmail({
    audience: "founder",
    subject: `${owner(c)} is waiting on you: ${c.subject}`,
    preheader: "Reply to keep things moving.",
    context: ref(c.refNo),
    headline: `${owner(c)} is waiting on you`,
    intro: `Hi ${firstName(c.founderName)}, ${owner(c)} asked you something on your request. Reply to keep things moving.`,
    blocks: lastStaffMessage ? [{ type: "quote", label: owner(c), text: clip(lastStaffMessage) }] : [],
    primary: { label: "Reply now", url: `${APP_URL}${founderSupportLink(c.requestId)}` },
    footer: founderFooter,
  });
}

export function resolvedEmail(c: FounderEmailCtx, summary: string | null, reminder = false): RenderedEmail {
  return renderEmail({
    audience: "founder",
    subject: reminder ? `Did ${owner(c)}'s answer solve it? ${c.subject}` : `Is your request solved? ${c.subject}`,
    preheader: "One click to tell us.",
    context: ref(c.refNo),
    headline: reminder ? "Quick check: is it solved?" : "Did this solve your issue?",
    intro: reminder
      ? `Hi ${firstName(c.founderName)}, we marked your request as resolved a couple of days ago. Did ${owner(c)}'s answer solve it?`
      : `Hi ${firstName(c.founderName)}, ${owner(c)} marked your request as resolved.`,
    blocks: [
      ...(summary ? [{ type: "quote" as const, label: "Summary", text: clip(summary, 1500) }] : []),
      { type: "paragraph", text: "One click tells us. No login needed. If it isn't solved, your request reopens with the same person at top priority." },
    ],
    primary: { label: "Yes, solved", url: supportConfirmUrl(c.requestId, "yes") },
    secondary: { label: "No, I still need help", url: supportConfirmUrl(c.requestId, "no") },
    footer: founderFooter,
  });
}

export function closedEmail(c: FounderEmailCtx): RenderedEmail {
  return renderEmail({
    audience: "founder",
    subject: `We've closed your request: ${c.subject}`,
    preheader: "Reply any time to reopen it.",
    context: ref(c.refNo),
    headline: "We've closed your request",
    intro: `Hi ${firstName(c.founderName)}, we haven't heard back, so we've closed this request. If anything is still not right, reopen it any time.`,
    primary: { label: "I still need help", url: supportConfirmUrl(c.requestId, "no") },
    footer: founderFooter,
  });
}

// ── Staff ───────────────────────────────────────────────────────────────

export type StaffEmailKind = "new" | "founder_reply" | "reminder" | "due_soon" | "overdue";

export function staffAlertEmail(input: {
  kind: StaffEmailKind;
  requestId: string;
  refNo: number | null;
  subject: string;
  companyName: string | null;
  founderName: string | null;
  ownerName: string | null;
  message: string | null;
  dueAt: string | null;
  openFor: string | null;
}): RenderedEmail {
  const who = [input.founderName, input.companyName].filter(Boolean).join(", ") || "A founder";
  const titles: Record<StaffEmailKind, string> = {
    new: "New support request",
    founder_reply: "Founder replied",
    reminder: "Still open",
    due_soon: "Reply due in 2 hours",
    overdue: "Promised reply time missed",
  };
  const facts = [
    { label: "Founder", value: who },
    { label: "Owner", value: input.ownerName ?? "Unassigned" },
    ...(input.dueAt ? [{ label: "Promised reply", value: formatSupportTime(input.dueAt) }] : []),
    ...(input.openFor ? [{ label: "Open for", value: input.openFor }] : []),
  ];
  return renderEmail({
    audience: "admin",
    subject: `[iCapOS Support] ${input.kind === "new" ? "" : `${titles[input.kind]}: `}${input.subject}`,
    preheader: input.message ? clip(input.message, 120) : `${titles[input.kind]} · ${who}`,
    context: ref(input.refNo),
    eyebrow: titles[input.kind],
    headline: input.subject,
    blocks: [
      { type: "facts", rows: facts },
      ...(input.message ? [{ type: "quote" as const, label: input.founderName ?? "Founder", text: clip(input.message) }] : []),
    ],
    primary: { label: "Open request", url: `${APP_URL}${staffSupportLink(input.requestId)}` },
    footer: { reason: "You're on the support notify list, or this request is assigned to you. Change it on Support queue, Notifications." },
  });
}

/** Send through Resend when configured; returns false (and sends nothing) otherwise. */
/** Founder emails can be answered by email: replies come back to the request. */
const FOUNDER_TYPES = new Set([
  "support_confirmation",
  "support_staff_reply",
  "support_resolved",
  "support_update",
  "support_waiting_on_you",
  "support_closed",
  "support_confirm_reminder",
]);

export async function deliverSupportEmail(input: {
  to: string | null | undefined;
  userId: string;
  email: RenderedEmail;
  type: string;
  deepLink: string;
  requestId: string;
}): Promise<boolean> {
  const replyTo = FOUNDER_TYPES.has(input.type) ? supportReplyAddress(input.requestId) : null;
  if (!process.env.RESEND_API_KEY?.trim() || !input.to || !input.to.includes("@")) return false;
  try {
    await sendTransactionalEmail({
      to: input.to,
      subject: input.email.subject,
      body: input.email.text,
      html: input.email.html,
      founderId: input.userId,
      notificationType: input.type,
      deepLink: input.deepLink,
      entityType: "support_request",
      entityId: input.requestId,
      ...(replyTo ? { replyTo } : {}),
    });
    return true;
  } catch {
    return false;
  }
}
