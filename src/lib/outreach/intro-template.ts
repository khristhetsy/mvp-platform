/**
 * intro_fit_v1 — the LOCKED investor-introduction template.
 *
 * COMPLIANCE: only the four merge fields below are dynamic (company, sector,
 * stage, investor first name). The body framing and the disclaimer footer are
 * fixed and MUST be replaced with counsel-approved copy before live sending is
 * enabled (INVESTOR_OUTREACH_LIVE=true). The placeholder text here is NOT legal
 * copy — it is a scaffold.
 */

export const INTRO_TEMPLATE_KEY = "intro_fit_v1";

export type IntroTemplateFields = {
  company: string;
  sector: string | null;
  stage: string | null;
  investorFirstName: string | null;
  unsubscribeUrl?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Fixed, counsel-approved-pending disclaimer. Do not template this per-recipient.
const LOCKED_DISCLAIMER =
  "This message is an introduction generated from platform fit scoring. It is not investment advice, " +
  "an offer, a solicitation, or a recommendation to buy or sell any security. iCapOS is not a broker-dealer " +
  "or investment adviser. Recipients should conduct their own diligence.";

export function renderIntroEmail(f: IntroTemplateFields): { subject: string; html: string; text: string } {
  const companyRaw = f.company.trim() || "a company";
  const company = escapeHtml(companyRaw);
  const sector = escapeHtml((f.sector ?? "").trim() || "its sector");
  const stage = escapeHtml((f.stage ?? "").trim() || "an early");
  const name = escapeHtml((f.investorFirstName ?? "").trim() || "there");
  const unsub = f.unsubscribeUrl ? escapeHtml(f.unsubscribeUrl) : "#";

  const subject = `An introduction that fits ${companyRaw}`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#22304a;max-width:560px">
  <p>Hello ${name},</p>
  <p>Based on your stated focus, our platform flagged a fit between your preferences and <strong>${company}</strong>, a ${sector} company at the ${stage} stage. We're sharing this as an <strong>introduction based on fit signals</strong>, not a recommendation.</p>
  <p>If you'd like an introduction, simply reply and our team will coordinate. If not, no action is needed.</p>
  <p>Warm regards,<br/>The iCapOS Introductions Team</p>
  <hr style="border:none;border-top:1px solid #e6e9f0;margin:20px 0 12px" />
  <p style="font-size:11px;color:#8a93a5">${LOCKED_DISCLAIMER} To stop receiving introductions, <a href="${unsub}" style="color:#8a93a5">unsubscribe</a>.</p>
</div>`;

  const text = `Hello ${name},

Based on your stated focus, our platform flagged a fit between your preferences and ${companyRaw}, a ${(f.sector ?? "its sector").trim() || "its sector"} company at the ${(f.stage ?? "an early").trim() || "an early"} stage. We're sharing this as an introduction based on fit signals, not a recommendation.

If you'd like an introduction, simply reply and our team will coordinate. If not, no action is needed.

Warm regards,
The iCapOS Introductions Team

${LOCKED_DISCLAIMER} To stop receiving introductions, unsubscribe: ${f.unsubscribeUrl ?? ""}`;

  return { subject, html, text };
}
