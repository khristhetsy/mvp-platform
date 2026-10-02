// Contract email: the cover email (with the documents attached and the signing
// link), reminders, sender notifications and the executed copy. Resend via raw
// fetch, the repo's convention. Without RESEND_API_KEY nothing is sent and the
// caller gets { delivered: false } so the sender can copy the link instead.

import "server-only";
import { getAppUrl, getResendApiKey } from "@/lib/env";
import { esc, fromFor, renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { logOutboundEmail } from "@/lib/email/email-log";

const RESEND_API_URL = "https://api.resend.com/emails";
const COMPANY = "iCFO Capital Global, Inc.";

export type Attachment = { filename: string; content: Buffer };

export function appBase(): string {
  return (getAppUrl() ?? "http://localhost:3000").replace(/\/$/, "");
}
export function packetUrl(token: string): string {
  return `${appBase()}/contracts/${token}`;
}

async function send(input: { to: string; fromName: string; replyTo?: string | null; mail: RenderedEmail; attachments?: Attachment[] }): Promise<{ delivered: boolean }> {
  const apiKey = getResendApiKey();
  if (!apiKey || !input.to.includes("@")) return { delivered: false };
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromFor("shared", input.fromName),
      to: [input.to],
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      subject: input.mail.subject,
      html: input.mail.html,
      text: input.mail.text,
      ...(input.attachments?.length
        ? { attachments: input.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
        : {}),
    }),
  });
  if (!res.ok) {
    await logOutboundEmail({ to: input.to, subject: input.mail.subject, html: input.mail.html, text: input.mail.text, status: "failed", error: `Email provider error ${res.status}`, source: "spv-contracts" });
    throw new Error(`Email delivery failed (${res.status}).`);
  }
  const sent = (await res.json().catch(() => null)) as { id?: string } | null;
  await logOutboundEmail({ to: input.to, subject: input.mail.subject, html: input.mail.html, text: input.mail.text, status: "sent", providerId: sent?.id ?? null, source: "spv-contracts" });
  return { delivered: true };
}

/** Plain text with blank-line paragraphs → email paragraphs. */
function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: "html" as const, html: `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#1f2937">${esc(p).replace(/\n/g, "<br>")}</p>` }));
}

export function buildCoverEmail(input: { subject: string; body: string; url: string; senderName: string }): RenderedEmail {
  return renderEmail({
    audience: "shared",
    subject: input.subject,
    preheader: "Documents for your review and signature.",
    context: COMPANY,
    blocks: [...paragraphs(input.body), { type: "note", text: "No account needed. The link is unique to you." }],
    primary: { label: "Review and sign", url: input.url },
    footer: { reason: `${input.senderName} sent you these documents from ${COMPANY}.` },
  });
}

export async function sendCoverEmail(input: {
  to: string;
  subject: string;
  body: string;
  token: string;
  senderName: string;
  senderEmail: string | null;
  attachments: Attachment[];
}) {
  const mail = buildCoverEmail({ subject: input.subject, body: input.body, url: packetUrl(input.token), senderName: input.senderName });
  return send({ to: input.to, fromName: `${input.senderName}, iCFO Capital Global`, replyTo: input.senderEmail, mail, attachments: input.attachments });
}

export async function sendReminderEmail(input: { to: string; firstName: string | null; documents: string[]; token: string; senderName: string; senderEmail: string | null }) {
  const mail = renderEmail({
    audience: "shared",
    subject: `Reminder: ${input.documents.join(", ")}`,
    preheader: "Your documents are still waiting for review.",
    context: COMPANY,
    intro: `${input.firstName ? `Hi ${input.firstName}, ` : ""}a quick reminder that the following documents are ready for your review: ${input.documents.join(", ")}.`,
    blocks: [{ type: "note", text: "No account needed. The link is unique to you." }],
    primary: { label: "Review and sign", url: packetUrl(input.token) },
    footer: { reason: `${input.senderName} sent you these documents from ${COMPANY}.` },
  });
  return send({ to: input.to, fromName: `${input.senderName}, iCFO Capital Global`, replyTo: input.senderEmail, mail });
}

/** Internal notice to the sender: prospect signed, declined or asked for changes. */
export async function notifySender(input: { to: string; subject: string; lines: string[]; url: string }) {
  const mail = renderEmail({
    audience: "shared",
    subject: input.subject,
    preheader: input.lines[0] ?? input.subject,
    context: "iCapOS Sales Hub",
    intro: input.lines[0] ?? "",
    blocks: input.lines.slice(1).map((text) => ({ type: "paragraph" as const, text })),
    primary: { label: "Open in Sales Hub", url: input.url },
    footer: { reason: "You sent this document from the iCapOS Sales Hub." },
  });
  return send({ to: input.to, fromName: "iCapOS Contracts", mail });
}

export async function sendExecutedCopy(input: { to: string; firstName: string | null; documentTitle: string; company: string; senderName: string; senderEmail: string | null; token: string; attachments: Attachment[] }) {
  const mail = renderEmail({
    audience: "shared",
    subject: `Completed: ${input.documentTitle}, ${input.company}`,
    preheader: "Signed by all parties. Your executed copy is attached.",
    context: COMPANY,
    intro: `${input.firstName ? `Hi ${input.firstName}, ` : ""}the ${input.documentTitle} has been signed by all parties. The fully executed copy is attached for your records, along with the signature certificate.`,
    primary: { label: "View your documents", url: packetUrl(input.token) },
    footer: { reason: `${input.senderName} sent you these documents from ${COMPANY}.` },
  });
  return send({ to: input.to, fromName: `${input.senderName}, iCFO Capital Global`, replyTo: input.senderEmail, mail, attachments: input.attachments });
}
