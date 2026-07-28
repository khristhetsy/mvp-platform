/**
 * Renders a founder's manual outreach email. The founder writes the subject and
 * body (with merge fields); this substitutes them, converts the body to safe
 * HTML, and appends the fixed disclaimer + unsubscribe footer.
 *
 * COMPLIANCE: the disclaimer is fixed and applies to every send. Merge fields are
 * the only dynamic parts of the body. The founder's copy is escaped — no raw HTML.
 */

export type ManualMergeFields = {
  firstName: string | null;
  company: string;
  sector: string | null;
  previewUrl: string | null;
  unsubscribeUrl: string;
};

const LOCKED_DISCLAIMER =
  "This message shares a company's Founder Preview based on stated fit. It is not investment advice, " +
  "an offer, a solicitation, or a recommendation to buy or sell any security. iCapOS is not a broker-dealer " +
  "or investment adviser.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyMerge(input: string, f: ManualMergeFields): string {
  return input
    .replaceAll("{{first_name}}", f.firstName ?? "there")
    .replaceAll("{{company}}", f.company)
    .replaceAll("{{sector}}", f.sector ?? "its sector")
    .replaceAll("{{founder_preview}}", f.previewUrl ?? "");
}

export function renderManualEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  f: ManualMergeFields,
): { subject: string; html: string; text: string } {
  const subject = applyMerge(subjectTemplate, f).trim() || `An introduction to ${f.company}`;
  const mergedText = applyMerge(bodyTemplate, f);

  const unsub = escapeHtml(f.unsubscribeUrl);
  const bodyHtml = escapeHtml(mergedText)
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#22304a;max-width:560px">
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #e6e9f0;margin:20px 0 12px" />
  <p style="font-size:11px;color:#8a93a5">${LOCKED_DISCLAIMER} To stop receiving these emails, <a href="${unsub}" style="color:#8a93a5">unsubscribe</a>.</p>
</div>`;

  const text = `${mergedText}

${LOCKED_DISCLAIMER} To stop receiving these emails, unsubscribe: ${f.unsubscribeUrl}`;

  return { subject, html, text };
}
