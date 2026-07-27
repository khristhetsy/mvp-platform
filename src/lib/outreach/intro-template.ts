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
  /** Link to the company's public Founder Preview one-pager (/f/[slug]). When
   *  present, the email leads with a "View the one-pager" button. */
  previewUrl?: string | null;
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
  const previewUrl = f.previewUrl ? escapeHtml(f.previewUrl) : null;

  const subject = `${companyRaw} — a Founder Preview that fits your focus`;

  const previewButtonHtml = previewUrl
    ? `<p style="margin:20px 0"><a href="${previewUrl}" style="display:inline-block;background:#4338CA;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">View the one-pager</a></p>`
    : "";
  const previewTextLine = f.previewUrl ? `\nView the one-pager: ${f.previewUrl}\n` : "";

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#22304a;max-width:560px">
  <p>Hello ${name},</p>
  <p>Based on your stated focus, our platform flagged a fit between your preferences and <strong>${company}</strong>, a ${sector} company at the ${stage} stage. We're sharing their <strong>Founder Preview</strong> — a one-pager the founding team put together — as an introduction based on fit signals, not a recommendation.</p>
  ${previewButtonHtml}
  <p>If you'd like an introduction to the team, simply reply and we'll coordinate. If not, no action is needed.</p>
  <p>Warm regards,<br/>The iCapOS Introductions Team</p>
  <hr style="border:none;border-top:1px solid #e6e9f0;margin:20px 0 12px" />
  <p style="font-size:11px;color:#8a93a5">${LOCKED_DISCLAIMER} To stop receiving introductions, <a href="${unsub}" style="color:#8a93a5">unsubscribe</a>.</p>
</div>`;

  const text = `Hello ${name},

Based on your stated focus, our platform flagged a fit between your preferences and ${companyRaw}, a ${(f.sector ?? "its sector").trim() || "its sector"} company at the ${(f.stage ?? "an early").trim() || "an early"} stage. We're sharing their Founder Preview one-pager as an introduction based on fit signals, not a recommendation.
${previewTextLine}
If you'd like an introduction to the team, simply reply and we'll coordinate. If not, no action is needed.

Warm regards,
The iCapOS Introductions Team

${LOCKED_DISCLAIMER} To stop receiving introductions, unsubscribe: ${f.unsubscribeUrl ?? ""}`;

  return { subject, html, text };
}
