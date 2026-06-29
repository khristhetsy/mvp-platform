// DD notifications via Resend (§16). Degrades gracefully without RESEND_API_KEY.

import { getResendApiKey, getAppUrl } from "@/lib/env";
import { getUserLocaleByEmail } from "@/lib/i18n/user-locale";
import { emailTranslator } from "@/lib/i18n/email-i18n";

const RESEND_API_URL = "https://api.resend.com/emails";
const SENDER = "iCFO Venture Group";

function brandedFrom(): string {
  const configured = process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ?? process.env.EMAIL_FROM?.trim() ?? "";
  const m = configured.match(/<([^>]+)>/);
  const address = m?.[1] ?? (configured.includes("@") ? configured : "no-reply@mail.icapos.com");
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

export async function sendFounderReady(to: string, companyName: string, eid: string) {
  const url = diligenceLink("founder", eid);
  const t = emailTranslator(await getUserLocaleByEmail(to));
  return send(to, t("diligence.founderReadySubject", { company: companyName }),
    [t("diligence.hello"), ``, t("diligence.founderReadyLine", { company: companyName }), ``, t("diligence.openHere"), url, ``, SENDER].join("\n"));
}

export async function sendDocumentsRequested(to: string, companyName: string, eid: string) {
  const url = diligenceLink("founder", eid);
  const t = emailTranslator(await getUserLocaleByEmail(to));
  return send(to, t("diligence.documentsRequestedSubject", { company: companyName }),
    [t("diligence.hello"), ``, t("diligence.documentsRequestedLine", { company: companyName }), ``, url, ``, SENDER].join("\n"));
}

function adminLink(eid: string): string {
  const base = (getAppUrl() ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/admin/diligence/${eid}`;
}

export function sendNewResponseToAdmin(to: string, companyName: string, eid: string) {
  return send(to, `New founder response — ${companyName}`,
    [`A founder has responded on the ${companyName} diligence.`, ``, adminLink(eid), ``, SENDER].join("\n"));
}

export function sendDocumentSubmittedToAdmin(to: string, companyName: string, eid: string) {
  return send(to, `Document submitted — verify — ${companyName}`,
    [`A document was submitted on the ${companyName} diligence and is ready to verify.`, ``, adminLink(eid), ``, SENDER].join("\n"));
}

export function sendFounderSigned(to: string, companyName: string, eid: string) {
  const url = diligenceLink("founder", eid).replace("/founder/", "/admin/"); // admin link
  return send(to, `Founder signed — ${companyName}`,
    [`Hello,`, ``, `The founder has signed the consent for ${companyName}. The version is sealed and the engagement is locked.`, ``, url, ``, SENDER].join("\n"));
}

export async function sendReleasedToInvestor(to: string, companyName: string, eid: string) {
  const url = diligenceLink("investor", eid);
  const t = emailTranslator(await getUserLocaleByEmail(to));
  return send(to, t("diligence.releasedSubject", { company: companyName }),
    [t("diligence.hello"), ``, t("diligence.releasedLine", { company: companyName }), ``, url, ``, SENDER].join("\n"));
}
