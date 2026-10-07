/**
 * intro_fit_v1: the LOCKED investor-introduction template.
 *
 * COMPLIANCE: copy approved by legal on 2026-09-28. Only the merge fields are
 * dynamic (company, sector, stage, investor first name, and the admin-edited
 * subject/intro/closing). The disclaimer footer is fixed. Any change to the
 * fixed wording needs a new legal review; intro-template.test.ts pins it.
 * Sending is controlled by the outreach master switch (admin setting, or
 * INVESTOR_OUTREACH_LIVE=true as an override).
 */

import { AUDIENCE_COLOR, EMAIL_BRAND_LEGAL_LINE, esc, renderEmail, type EmailBlock } from "@/lib/email/layout";

export const INTRO_TEMPLATE_KEY = "intro_fit_v1";

export type IntroTemplateFields = {
  company: string;
  sector: string | null;
  stage: string | null;
  investorFirstName: string | null;
  unsubscribeUrl?: string | null;
  /** Link to the company's public Founder Preview one-pager (/f/[slug]). When
   *  present, the email leads with an embedded one-pager preview card + button. */
  previewUrl?: string | null;
  /** One-line tagline (company business_description), shown in the card. */
  tagline?: string | null;
  /** Formatted raise, e.g. "~$2M". */
  raise?: string | null;
  /** City / region, e.g. "New York". */
  location?: string | null;
  /** Admin-edited copy (subject / intro / closing) with {{company}} /
   *  {{investor}} / {{stage}} / {{sector}} merge fields. Defaults when absent. */
  message?: { subject: string; intro: string; closing: string };
};

const DEFAULT_MESSAGE = {
  subject: "{{company}}: a Founder Preview that fits your focus",
  intro: "Hi {{investor}},\n\nOur fit scoring matched {{company}} to your stated preferences. Here's their Founder Preview, no obligation.",
  closing: "If it's a fit, simply reply and we'll make the introduction. If not, no action is needed.",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Fixed disclaimer, approved by legal 2026-09-28; iCFO Capital sentence added 2026-10-07
// at Khris's direction (required on all founder and investor facing materials).
// Do not template this per-recipient.
const LOCKED_DISCLAIMER =
  "This message is an introduction generated from platform fit scoring. It is not investment advice, " +
  "an offer, a solicitation, or a recommendation to buy or sell any security. iCapOS is not a broker-dealer " +
  "or investment adviser. Recipients should conduct their own diligence. iCFO Capital Global, Inc. does not " +
  "solicit securities and is not an investment adviser. This content is for educational purposes only.";

export function renderIntroEmail(f: IntroTemplateFields): { subject: string; html: string; text: string } {
  const companyRaw = f.company.trim() || "a company";
  const previewUrl = f.previewUrl ? escapeHtml(f.previewUrl) : null;

  // Admin-edited copy with merge fields; values substituted per recipient.
  const message = f.message ?? DEFAULT_MESSAGE;
  const mergeValues: Record<string, string> = {
    company: companyRaw,
    investor: (f.investorFirstName ?? "").trim() || "there",
    stage: (f.stage ?? "").trim(),
    sector: (f.sector ?? "").trim(),
  };
  const subst = (s: string) => s.replace(/\{\{\s*(company|investor|stage|sector)\s*\}\}/gi, (_, k: string) => mergeValues[k.toLowerCase()] ?? "");

  const subject = subst(message.subject).trim() || `${companyRaw}: a Founder Preview`;

  const paraBlocks = (s: string): EmailBlock[] =>
    subst(s)
      .split(/\n{2,}/)
      .filter((p) => p.trim() !== "")
      .map((p) => ({ type: "html", html: `<p style="margin:0;font-size:15px;line-height:24px;">${esc(p).replace(/\n/g, "<br/>")}</p>` }));

  // The email IS the Founder Preview: an embedded one-pager card + a link to the
  // full page. Rendered only when the company has a published one-pager.
  const meta: Array<{ label: string; value: string }> = [];
  if (f.raise?.trim()) meta.push({ label: "Raising", value: f.raise.trim() });
  const stageRaw = (f.stage ?? "").trim();
  const sectorRaw = (f.sector ?? "").trim();
  if (stageRaw) meta.push({ label: "Stage", value: sectorRaw ? `${stageRaw} · ${sectorRaw}` : stageRaw });
  if (f.location?.trim()) meta.push({ label: "Location", value: f.location.trim() });
  const cardBlocks: EmailBlock[] = previewUrl
    ? [
        { type: "card", name: companyRaw, tagline: f.tagline?.trim() || null, meta },
        {
          type: "html",
          html: `<a href="${previewUrl}" style="display:inline-block;background:${AUDIENCE_COLOR.investor};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px;">View full one-pager →</a>`,
        },
      ]
    : [];
  const previewTextLine = f.previewUrl ? `\nView the full one-pager: ${f.previewUrl}\n` : "";

  // Layout only. Every word below is the fixed copy above; the shared layout
  // adds the logo, the audience rule and the company address line.
  const firstPara = subst(message.intro).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const { html } = renderEmail({
    audience: "investor",
    subject,
    preheader: firstPara[1] ?? firstPara[0] ?? subject,
    blocks: [
      ...paraBlocks(message.intro),
      ...cardBlocks,
      ...paraBlocks(message.closing),
      { type: "html", html: `<p style="margin:0;font-size:15px;line-height:24px;">Warm regards,<br/>The iCapOS Introductions Team</p>` },
    ],
    footer: {
      reason: `${LOCKED_DISCLAIMER} To stop receiving introductions,`,
      preferencesUrl: f.unsubscribeUrl ?? "#",
      preferencesLabel: "unsubscribe",
    },
  });

  const plain = (s: string) => subst(s);
  const text = `${plain(message.intro)}
${previewTextLine}
${plain(message.closing)}

Warm regards,
The iCapOS Introductions Team

${LOCKED_DISCLAIMER} To stop receiving introductions, unsubscribe: ${f.unsubscribeUrl ?? ""}

${EMAIL_BRAND_LEGAL_LINE}`;

  return { subject, html, text };
}
