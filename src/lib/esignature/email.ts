// Transactional email for the e-signature feature (Resend via raw fetch, the
// repo's convention). Degrades gracefully: without RESEND_API_KEY, sends no-op
// and return { delivered: false } rather than throwing.

import { getResendApiKey, getAppUrl } from "@/lib/env";
import { BRAND } from "./types";
import { fromFor, renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { logOutboundEmail } from "@/lib/email/email-log";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Public signing URL for a token. */
export function buildSignUrl(token: string): string {
  const base = getAppUrl() ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/sign/${token}`;
}

/** Public sealed-document download URL for a token. */
export function buildSealedDocUrl(token: string): string {
  const base = getAppUrl() ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/sign/${token}/document`;
}

async function send(to: string, mail: RenderedEmail): Promise<{ delivered: boolean }> {
  const apiKey = getResendApiKey();
  if (!apiKey || !to.includes("@")) return { delivered: false };

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromFor("shared", BRAND.emailSender), to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) {
    const detail = await res.text();
    await logOutboundEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, status: "failed", error: `Email provider error ${res.status}`, source: "e-signature" });
    throw new Error(`Email delivery failed: ${detail}`);
  }
  const sent = (await res.json().catch(() => null)) as { id?: string } | null;
  await logOutboundEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, status: "sent", providerId: sent?.id ?? null, source: "e-signature" });
  return { delivered: true };
}

const FOOTER = `Sent through iCapOS e-signature on behalf of ${BRAND.emailSender}.`;

/** The signing invitation. Pure. */
export function buildSigningInviteEmail(input: { signerName: string | null; documentName: string; dealLabel: string | null; signUrl: string }): RenderedEmail {
  const first = input.signerName?.trim().split(/\s+/)[0];
  return renderEmail({
    audience: "shared",
    subject: `Review and sign: ${input.documentName}`,
    preheader: `${input.dealLabel ? `${input.dealLabel}. ` : ""}Secure, single use link from ${BRAND.emailSender}.`,
    context: BRAND.emailSender,
    eyebrow: "Signature requested",
    headline: `Review and sign the ${input.documentName}`,
    intro: `${first ? `Hi ${first}, ` : ""}${BRAND.emailSender} has sent you a document to review and sign.`,
    blocks: [
      { type: "facts", rows: [{ label: "Document", value: input.documentName }, ...(input.dealLabel ? [{ label: "Deal", value: input.dealLabel }] : [])] },
      { type: "note", text: "This is a secure, single use link. If you weren't expecting this, you can ignore this email." },
    ],
    primary: { label: "Review and sign", url: input.signUrl },
    footer: { reason: FOOTER },
  });
}

/** The completion notice with the sealed copy. Pure. */
export function buildCompletionEmail(input: { documentName: string; url: string; forSigner: boolean }): RenderedEmail {
  const line = input.forSigner
    ? `Your signed copy of "${input.documentName}" is ready.`
    : `"${input.documentName}" has been signed and completed.`;
  return renderEmail({
    audience: "shared",
    subject: `Completed: ${input.documentName}`,
    preheader: line,
    context: BRAND.emailSender,
    eyebrow: "Signature complete",
    headline: `${input.documentName} is signed`,
    intro: line,
    primary: { label: "View signed document", url: input.url },
    footer: { reason: FOOTER },
  });
}

/** Invite the signer to review and sign. */
export async function sendSigningInvite(input: {
  to: string;
  signerName: string | null;
  documentName: string;
  dealLabel: string | null;
  token: string;
}): Promise<{ delivered: boolean }> {
  const mail = buildSigningInviteEmail({ signerName: input.signerName, documentName: input.documentName, dealLabel: input.dealLabel, signUrl: buildSignUrl(input.token) });
  return send(input.to, mail);
}

/** Notify a party that the document is complete, with the sealed-copy link. */
export async function sendCompletionNotice(input: {
  to: string;
  documentName: string;
  token: string;
  forSigner: boolean;
}): Promise<{ delivered: boolean }> {
  return send(input.to, buildCompletionEmail({ documentName: input.documentName, url: buildSealedDocUrl(input.token), forSigner: input.forSigner }));
}
