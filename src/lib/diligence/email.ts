// DD notifications via Resend (§16). Degrades gracefully without RESEND_API_KEY.

import { getResendApiKey, getAppUrl } from "@/lib/env";

const RESEND_API_URL = "https://api.resend.com/emails";
const SENDER = "iCFO Venture Group";

function brandedFrom(): string {
  const configured = process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ?? process.env.EMAIL_FROM?.trim() ?? "";
  const m = configured.match(/<([^>]+)>/);
  const address = m?.[1] ?? (configured.includes("@") ? configured : "no-reply@mail.capitalos.io");
  return `${SENDER} <${address}>`;
}

export function diligenceLink(role: "founder" | "investor", eid: string): string {
  const base = (getAppUrl() ?? "http://localhost:3000").replace(/\/$/, "");
  return role === "founder" ? `${base}/founder/diligence/${eid}` : `${base}/investor/deals/${eid}`;
}

async function send(to: string, subject: string, text: string): Promise<{ delivered: boolean }> {
  const key = getResendApiKey();
  if (!key || !to.includes("@")) return { delivered: false };
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: brandedFrom(), to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return { delivered: true };
}

export function sendFounderReady(to: string, companyName: string, eid: string) {
  const url = diligenceLink("founder", eid);
  return send(to, `Diligence ready for your input — ${companyName}`,
    [`Hello,`, ``, `The diligence report for ${companyName} is ready for your review and response.`, ``, `Open it here:`, url, ``, SENDER].join("\n"));
}

export function sendDocumentsRequested(to: string, companyName: string, eid: string) {
  const url = diligenceLink("founder", eid);
  return send(to, `Documents requested — ${companyName}`,
    [`Hello,`, ``, `New documents have been requested for the ${companyName} diligence.`, ``, url, ``, SENDER].join("\n"));
}

export function sendReleasedToInvestor(to: string, companyName: string, eid: string) {
  const url = diligenceLink("investor", eid);
  return send(to, `Deal available — ${companyName}`,
    [`Hello,`, ``, `The diligence package for ${companyName} is now available.`, ``, url, ``, SENDER].join("\n"));
}
