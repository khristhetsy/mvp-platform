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
  subject: "{{company}} — a Founder Preview that fits your focus",
  intro: "Hi {{investor}},\n\nOur fit scoring matched {{company}} to your stated preferences. Here's their Founder Preview — no obligation.",
  closing: "If it's a fit, simply reply and we'll make the introduction. If not, no action is needed.",
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
  const unsub = f.unsubscribeUrl ? escapeHtml(f.unsubscribeUrl) : "#";
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
  const toParas = (s: string) => subst(s).split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");

  const subject = subst(message.subject).trim() || `${companyRaw} — a Founder Preview`;
  const introHtml = toParas(message.intro);
  const closingHtml = toParas(message.closing);

  const tagline = f.tagline ? escapeHtml(f.tagline.trim()) : null;
  const raise = f.raise ? escapeHtml(f.raise.trim()) : null;
  const location = f.location ? escapeHtml(f.location.trim()) : null;
  const initial = companyRaw.slice(0, 1).toUpperCase();
  const metaCells = [
    raise ? `<td style="padding:0 18px 0 0;vertical-align:top"><div style="font-size:11px;color:#8a93a5">Raising</div><div style="font-size:13px;color:#22304a;font-weight:600">${raise}</div></td>` : "",
    stage !== "an early" ? `<td style="padding:0 18px 0 0;vertical-align:top"><div style="font-size:11px;color:#8a93a5">Stage</div><div style="font-size:13px;color:#22304a;font-weight:600">${stage}${sector !== "its sector" ? ` · ${sector}` : ""}</div></td>` : "",
    location ? `<td style="padding:0;vertical-align:top"><div style="font-size:11px;color:#8a93a5">Location</div><div style="font-size:13px;color:#22304a;font-weight:600">${location}</div></td>` : "",
  ].join("");

  // The email IS the Founder Preview: an embedded one-pager card + a link to the
  // full page. Rendered only when the company has a published one-pager.
  const cardHtml = previewUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e6e9f0;border-radius:12px;margin:18px 0">
    <tr><td style="padding:16px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:40px;vertical-align:middle"><div style="width:40px;height:40px;border-radius:9px;background:#EEEDFE;color:#3C3489;font-weight:700;font-size:16px;text-align:center;line-height:40px">${initial}</div></td>
        <td style="padding-left:12px;vertical-align:middle"><div style="font-size:15px;font-weight:600;color:#22304a">${company}</div>${tagline ? `<div style="font-size:13px;color:#5b6577">${tagline}</div>` : ""}</td>
      </tr></table>
      ${metaCells ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>${metaCells}</tr></table>` : ""}
      <div style="margin-top:16px"><a href="${previewUrl}" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px">View full one-pager →</a></div>
    </td></tr>
  </table>`
    : "";
  const previewTextLine = f.previewUrl ? `\nView the full one-pager: ${f.previewUrl}\n` : "";

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#22304a;max-width:560px">
  ${introHtml}
  ${cardHtml}
  ${closingHtml}
  <p>Warm regards,<br/>The iCapOS Introductions Team</p>
  <hr style="border:none;border-top:1px solid #e6e9f0;margin:20px 0 12px" />
  <p style="font-size:11px;color:#8a93a5">${LOCKED_DISCLAIMER} To stop receiving introductions, <a href="${unsub}" style="color:#8a93a5">unsubscribe</a>.</p>
</div>`;

  const plain = (s: string) => subst(s);
  const text = `${plain(message.intro)}
${previewTextLine}
${plain(message.closing)}

Warm regards,
The iCapOS Introductions Team

${LOCKED_DISCLAIMER} To stop receiving introductions, unsubscribe: ${f.unsubscribeUrl ?? ""}`;

  return { subject, html, text };
}
