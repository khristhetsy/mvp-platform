// Transactional email for the e-signature feature (Resend via raw fetch, the
// repo's convention). Degrades gracefully: without RESEND_API_KEY, sends no-op
// and return { delivered: false } rather than throwing.

import { getResendApiKey, getAppUrl } from "@/lib/env";
import { BRAND } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Public signing URL for a token. */
export function buildSignUrl(token: string): string {
  const base = getAppUrl() ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/sign/${token}`;
}

/** From header — branded sender name "iCFO Venture Group" over the configured address. */
function brandedFrom(): string {
  const configured =
    process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ?? process.env.EMAIL_FROM?.trim() ?? "";
  // Extract a bare address if EMAIL_FROM is in "Name <addr>" form.
  const addrMatch = configured.match(/<([^>]+)>/);
  const address = addrMatch?.[1] ?? (configured.includes("@") ? configured : "no-reply@mail.capitalos.io");
  return `${BRAND.emailSender} <${address}>`;
}

async function send(input: { to: string; subject: string; text: string }): Promise<{ delivered: boolean }> {
  const apiKey = getResendApiKey();
  if (!apiKey || !input.to.includes("@")) return { delivered: false };

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: brandedFrom(), to: [input.to], subject: input.subject, text: input.text }),
  });
  if (!res.ok) throw new Error(`Email delivery failed: ${await res.text()}`);
  return { delivered: true };
}

/** Invite the signer to review and sign. */
export async function sendSigningInvite(input: {
  to: string;
  signerName: string | null;
  documentName: string;
  dealLabel: string | null;
  token: string;
}): Promise<{ delivered: boolean }> {
  const signUrl = buildSignUrl(input.token);
  const hello = input.signerName ? `Hi ${input.signerName},` : "Hello,";
  const dealLine = input.dealLabel ? ` (${input.dealLabel})` : "";
  const text = [
    hello,
    "",
    `${BRAND.emailSender} has sent you a document to review and sign: ${input.documentName}${dealLine}.`,
    "",
    "Review and sign:",
    signUrl,
    "",
    "This is a secure, single-use link. If you weren't expecting this, you can ignore this email.",
    "",
    BRAND.emailSender,
  ].join("\n");

  return send({ to: input.to, subject: `Review and sign: ${input.documentName}`, text });
}
