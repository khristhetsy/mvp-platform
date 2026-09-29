// DD notifications via Resend (§16). Degrades gracefully without RESEND_API_KEY.
// Founder and investor emails are localized; staff emails are English.

import { getResendApiKey, getAppUrl } from "@/lib/env";
import { getUserLocaleByEmail } from "@/lib/i18n/user-locale";
import { emailTranslator, type EmailT } from "@/lib/i18n/email-i18n";
import { fromFor, renderEmail, type EmailAudience, type RenderedEmail } from "@/lib/email/layout";
import { logOutboundEmail } from "@/lib/email/email-log";

const RESEND_API_URL = "https://api.resend.com/emails";
const SENDER = "iCFO Venture Group";

export function diligenceLink(role: "founder" | "investor", eid: string): string {
  const base = (getAppUrl() ?? "http://localhost:3000").replace(/\/$/, "");
  return role === "founder" ? `${base}/founder/diligence/${eid}` : `${base}/investor/deals/${eid}`;
}

async function send(to: string, audience: EmailAudience, mail: RenderedEmail): Promise<{ delivered: boolean }> {
  const key = getResendApiKey();
  if (!key || !to.includes("@")) return { delivered: false };
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromFor(audience, audience === "admin" ? null : SENDER),
      to: [to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    await logOutboundEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, status: "failed", error: `Email provider error ${res.status}`, source: "diligence", audience: audience === "admin" ? "staff" : audience === "shared" ? null : audience });
    throw new Error(detail);
  }
  const sent = (await res.json().catch(() => null)) as { id?: string } | null;
  await logOutboundEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, status: "sent", providerId: sent?.id ?? null, source: "diligence", audience: audience === "admin" ? "staff" : audience === "shared" ? null : audience });
  return { delivered: true };
}

function adminLink(eid: string): string {
  const base = (getAppUrl() ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/admin/diligence/${eid}`;
}

// ── Pure builders (tested) ────────────────────────────────────────────────

type Kind = "founderReady" | "documentsRequested" | "released";

/** Founder and investor emails, in the recipient's language. */
export function buildDiligenceEmail(kind: Kind, t: EmailT, companyName: string, url: string): RenderedEmail {
  const company = { company: companyName };
  const investor = kind === "released";
  const copy = {
    founderReady: { subject: "founderReadySubject", headline: "founderReadyHeadline", line: "founderReadyLine", cta: "founderReadyCta" },
    documentsRequested: { subject: "documentsRequestedSubject", headline: "documentsRequestedHeadline", line: "documentsRequestedLine", cta: "documentsRequestedCta" },
    released: { subject: "releasedSubject", headline: "releasedHeadline", line: "releasedLine", cta: "releasedCta" },
  }[kind];
  return renderEmail({
    audience: investor ? "investor" : "founder",
    subject: t(`diligence.${copy.subject}`, company),
    preheader: t(`diligence.${copy.line}`, company),
    context: SENDER,
    eyebrow: t("diligence.eyebrow"),
    headline: t(`diligence.${copy.headline}`, company),
    intro: t(`diligence.${copy.line}`, company),
    primary: { label: t(`diligence.${copy.cta}`), url },
    footer: {
      reason: t(investor ? "diligence.footerInvestor" : "diligence.footerFounder", company),
      lines: [t(investor ? "diligence.noOffer" : "diligence.notBrokerDealer")],
    },
  });
}

type AdminKind = "newResponse" | "documentSubmitted" | "founderSigned";

/** Staff emails. English. */
export function buildDiligenceAdminEmail(kind: AdminKind, companyName: string, url: string): RenderedEmail {
  const copy = {
    newResponse: {
      subject: `Founder responded: ${companyName} diligence`,
      headline: `The founder responded on ${companyName}`,
      intro: `A founder has responded on the ${companyName} diligence. Review the answers and close or reopen each item.`,
      cta: "Review responses",
    },
    documentSubmitted: {
      subject: `Verify a document: ${companyName} diligence`,
      headline: "A document is ready to verify",
      intro: `A document was submitted on the ${companyName} diligence. It stays pending until someone on the team verifies it.`,
      cta: "Verify document",
    },
    founderSigned: {
      subject: `Founder signed: ${companyName} diligence is sealed`,
      headline: `${companyName} signed the consent`,
      intro: `The founder has signed the consent for ${companyName}. The version is sealed and the engagement is locked.`,
      cta: "Open engagement",
    },
  }[kind];
  return renderEmail({
    audience: "admin",
    subject: copy.subject,
    preheader: copy.intro,
    context: companyName,
    eyebrow: "Due diligence",
    headline: copy.headline,
    intro: copy.intro,
    primary: { label: copy.cta, url },
    footer: { reason: "Internal. Sent to the diligence lead on this engagement." },
  });
}

// ── Senders ───────────────────────────────────────────────────────────────

export async function sendFounderReady(to: string, companyName: string, eid: string) {
  const t = emailTranslator(await getUserLocaleByEmail(to));
  return send(to, "founder", buildDiligenceEmail("founderReady", t, companyName, diligenceLink("founder", eid)));
}

export async function sendDocumentsRequested(to: string, companyName: string, eid: string) {
  const t = emailTranslator(await getUserLocaleByEmail(to));
  return send(to, "founder", buildDiligenceEmail("documentsRequested", t, companyName, diligenceLink("founder", eid)));
}

export function sendNewResponseToAdmin(to: string, companyName: string, eid: string) {
  return send(to, "admin", buildDiligenceAdminEmail("newResponse", companyName, adminLink(eid)));
}

export function sendDocumentSubmittedToAdmin(to: string, companyName: string, eid: string) {
  return send(to, "admin", buildDiligenceAdminEmail("documentSubmitted", companyName, adminLink(eid)));
}

export function sendFounderSigned(to: string, companyName: string, eid: string) {
  return send(to, "admin", buildDiligenceAdminEmail("founderSigned", companyName, adminLink(eid)));
}

export async function sendReleasedToInvestor(to: string, companyName: string, eid: string) {
  const t = emailTranslator(await getUserLocaleByEmail(to));
  return send(to, "investor", buildDiligenceEmail("released", t, companyName, diligenceLink("investor", eid)));
}
