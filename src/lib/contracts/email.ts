// Contract email: the cover email (with the documents attached and the signing
// link), reminders, sender notifications and the executed copy. Resend via raw
// fetch, the repo's convention. Without RESEND_API_KEY nothing is sent and the
// caller gets { delivered: false } so the sender can copy the link instead.

import "server-only";
import { getAppUrl, getResendApiKey } from "@/lib/env";
import { esc, fromFor, renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { logOutboundEmail } from "@/lib/email/email-log";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { COVER_COMPANY, COVER_FROM_SUFFIX, htmlToText, type CoverLook } from "./cover-signature";

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

/**
 * Plain cover email: reads like an email typed in Gmail. The body, one line
 * with the signing (or viewing) link, then the sender's own signature. No
 * header card, no button.
 */
function buildPlainCover(input: { subject: string; body: string; url: string; reviewOnly?: boolean; look: CoverLook; testNote?: string }): RenderedEmail {
  const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;
  const bodyParas = input.body
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  const linkLabel = input.reviewOnly ? "View the documents" : "Review and sign the documents";
  const linkLine = input.reviewOnly
    ? `The documents are attached for your review. No signature is requested. You can also <a href="${esc(input.url)}" style="color:#1155cc;">view them online</a>.`
    : `<a href="${esc(input.url)}" style="color:#1155cc;">${linkLabel}</a>. No account is needed, and the link is unique to you.`;
  const linkText = input.reviewOnly
    ? `The documents are attached for your review. No signature is requested. You can also view them online: ${input.url}`
    : `${linkLabel}: ${input.url}\nNo account is needed, and the link is unique to you.`;
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">',
    input.testNote ? p(`<i style="color:#854F0B;">${esc(input.testNote)}</i>`) : "",
    ...bodyParas.map((x) => p(esc(x).replace(/\n/g, "<br>"))),
    p(linkLine),
    `<div style="margin-top:18px;">${input.look.signatureHtml}</div>`,
    "</div>",
  ].join("");
  const text = [input.testNote ?? "", ...bodyParas, linkText, htmlToText(input.look.signatureHtml)].filter(Boolean).join("\n\n");
  return { subject: input.subject, html, text };
}

export function buildCoverEmail(input: { subject: string; body: string; url: string; senderName: string; reviewOnly?: boolean; look?: CoverLook }): RenderedEmail {
  if (input.look?.style === "plain") return buildPlainCover({ ...input, look: input.look });
  const company = input.look ? COVER_COMPANY[input.look.brand] : COMPANY;
  return renderEmail({
    audience: "shared",
    subject: input.subject,
    preheader: input.reviewOnly ? "Documents for your review." : "Documents for your review and signature.",
    context: company,
    blocks: [...paragraphs(input.body), { type: "note", text: input.reviewOnly ? "The documents are attached. No signature is requested." : "No account needed. The link is unique to you." }],
    primary: { label: input.reviewOnly ? "View documents" : "Review and sign", url: input.url },
    footer: { reason: `${input.senderName} sent you these documents from ${company}.` },
  });
}

/** From display name for iCapOS mail sends: "Khris Thetsy, iCapOS". */
function fromNameFor(senderName: string, look?: CoverLook) {
  return `${senderName}, ${look ? COVER_FROM_SUFFIX[look.brand] : "iCFO Capital Global"}`;
}

export async function sendCoverEmail(input: {
  to: string;
  subject: string;
  body: string;
  token: string;
  senderName: string;
  senderEmail: string | null;
  attachments: Attachment[];
  /** Review only: no signing link wording. */
  reviewOnly?: boolean;
  /** Plain or branded, iCFO or iCapOS. Omitted: the branded iCFO card (resends). */
  look?: CoverLook;
}) {
  const mail = buildCoverEmail({ subject: input.subject, body: input.body, url: packetUrl(input.token), senderName: input.senderName, reviewOnly: input.reviewOnly, look: input.look });
  return send({ to: input.to, fromName: fromNameFor(input.senderName, input.look), replyTo: input.senderEmail, mail, attachments: input.attachments });
}

/**
 * The cover email sent from the sender's own connected Gmail account (gmail.send).
 * Same content and attachments as the iCapOS mail version; the message lands in
 * the sender's Gmail Sent folder and replies thread there.
 */
export async function sendCoverEmailViaGmail(input: {
  userId: string;
  to: string;
  subject: string;
  body: string;
  token: string;
  senderName: string;
  attachments: Attachment[];
  reviewOnly?: boolean;
  look?: CoverLook;
}): Promise<{ delivered: boolean }> {
  if (!input.to.includes("@")) return { delivered: false };
  const mail = buildCoverEmail({ subject: input.subject, body: input.body, url: packetUrl(input.token), senderName: input.senderName, reviewOnly: input.reviewOnly, look: input.look });
  const r = await sendViaGmail({
    userId: input.userId,
    to: input.to,
    subject: mail.subject,
    body: mail.text,
    html: mail.html,
    attachments: input.attachments.map((a) => ({ name: a.filename, mimeType: "application/pdf", content: a.content })),
  });
  if ("error" in r) {
    await logOutboundEmail({ to: input.to, subject: mail.subject, html: mail.html, text: mail.text, status: "failed", error: r.error.message.slice(0, 300), source: "spv-contracts" });
    throw r.error;
  }
  await logOutboundEmail({ to: input.to, subject: mail.subject, html: mail.html, text: mail.text, status: "sent", providerId: `gmail:${r.messageId}`, source: "spv-contracts" });
  return { delivered: true };
}

/**
 * A test copy of the cover email, sent only to the person sending: "[TEST]" in
 * the subject, a test note at the top, and the button pointing back to the
 * send page (a test creates no signing link). Same body, sender and PDFs as
 * the real send, so what arrives is what the prospect would get.
 */
export function buildTestCoverEmail(input: { subject: string; body: string; senderName: string; reviewOnly?: boolean; backUrl: string; prospectName: string; look?: CoverLook }): RenderedEmail {
  if (input.look?.style === "plain") {
    return buildPlainCover({
      subject: `[TEST] ${input.subject}`,
      body: input.body,
      url: input.backUrl,
      reviewOnly: input.reviewOnly,
      look: input.look,
      testNote: `Test copy. Only you received this; nothing was sent to ${input.prospectName}. The link below goes back to the send page, because a test creates no signing link.`,
    });
  }
  const company = input.look ? COVER_COMPANY[input.look.brand] : COMPANY;
  return renderEmail({
    audience: "shared",
    subject: `[TEST] ${input.subject}`,
    preheader: `Test copy. Only you received this; nothing was sent to ${input.prospectName}.`,
    context: company,
    blocks: [
      { type: "note", tone: "warning", text: `Test copy. Only you received this; nothing was sent to ${input.prospectName}. The button below goes back to the send page, because a test creates no signing link.` },
      ...paragraphs(input.body),
      { type: "note", text: input.reviewOnly ? "The documents are attached. No signature is requested." : "No account needed. The link is unique to you." },
    ],
    primary: { label: input.reviewOnly ? "View documents" : "Review and sign", url: input.backUrl },
    footer: { reason: `${input.senderName} sent you these documents from ${company}.` },
  });
}

/** Sends the test copy to the sender, through the same route the real send would use. */
export async function sendTestCoverEmail(input: {
  via: "gmail" | "icapos";
  userId: string;
  to: string;
  senderName: string;
  senderEmail: string | null;
  mail: RenderedEmail;
  attachments: Attachment[];
  look?: CoverLook;
}): Promise<{ delivered: boolean }> {
  if (!input.to.includes("@")) return { delivered: false };
  if (input.via !== "gmail") {
    return send({ to: input.to, fromName: fromNameFor(input.senderName, input.look), replyTo: input.senderEmail, mail: input.mail, attachments: input.attachments });
  }
  const r = await sendViaGmail({
    userId: input.userId,
    to: input.to,
    subject: input.mail.subject,
    body: input.mail.text,
    html: input.mail.html,
    attachments: input.attachments.map((a) => ({ name: a.filename, mimeType: "application/pdf", content: a.content })),
  });
  if ("error" in r) {
    await logOutboundEmail({ to: input.to, subject: input.mail.subject, html: input.mail.html, text: input.mail.text, status: "failed", error: r.error.message.slice(0, 300), source: "spv-contracts-test" });
    throw r.error;
  }
  await logOutboundEmail({ to: input.to, subject: input.mail.subject, html: input.mail.html, text: input.mail.text, status: "sent", providerId: `gmail:${r.messageId}`, source: "spv-contracts-test" });
  return { delivered: true };
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
    context: "iCapOS Sales",
    intro: input.lines[0] ?? "",
    blocks: input.lines.slice(1).map((text) => ({ type: "paragraph" as const, text })),
    primary: { label: "Open in Sales", url: input.url },
    footer: { reason: "You sent this document from the iCapOS Sales." },
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
