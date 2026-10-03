/**
 * The email a registered investor gets when iCFO makes a founder requested
 * introduction. Pure. Match reasons are stated in words from the facts that
 * actually line up; no match percentages, and nothing is claimed that the
 * investor's own preferences don't show.
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";
import { NOT_A_BROKER_DEALER } from "@/lib/email/layout";

export type InvestorIntroEmailInput = {
  firstName: string | null;
  companyName: string;
  industry: string | null;
  fundingStage: string | null;
  /** Already formatted, e.g. "$3M" or a band label. */
  raising: string | null;
  /** Plain words, e.g. ["industry", "stage"]. Empty when nothing is known to align. */
  alignedOn: string[];
  note: string | null;
  dashboardUrl: string;
};

export function formatRaise(amount: number | null, band: string | null): string | null {
  if (band && band.trim()) return band.trim();
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

/** "a Series A fintech company raising $3M", trimmed to what is known. */
export function describeCompany(input: Pick<InvestorIntroEmailInput, "companyName" | "industry" | "fundingStage" | "raising">): string {
  const parts = [input.fundingStage?.trim(), input.industry?.trim()].filter((p): p is string => Boolean(p));
  const what = parts.length ? `a ${parts.join(" ")} company` : "a company";
  return `${input.companyName}, ${what}${input.raising ? ` raising ${input.raising}` : ""}`;
}

export function renderInvestorIntroEmail(input: InvestorIntroEmailInput): { subject: string; text: string; html: string } {
  const subject = `Introduction from iCFO · ${input.companyName}`;
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const intro = `iCFO is introducing you to ${describeCompany(input)}.`;
  const fit = input.alignedOn.length ? `They match your focus on ${listWords(input.alignedOn)}.` : null;
  const note = input.note?.trim() || null;
  const next = "Reply to this email or open your iCapOS dashboard to take it from here.";

  const text = [greeting, "", [intro, fit].filter(Boolean).join(" "), note ? `\nNote from iCFO: ${note}` : null, "", next, `Dashboard: ${input.dashboardUrl}`]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = shell(
    `<p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>` +
      `<p style="margin:0 0 14px;">${escapeHtml(intro)}${fit ? ` ${escapeHtml(fit)}` : ""}</p>` +
      (note
        ? `<div style="background:#F4F6FB;border-radius:8px;padding:10px 12px;font-size:13px;margin:0 0 16px;">Note from iCFO: ${escapeHtml(note)}</div>`
        : "") +
      `<p style="margin:0 0 14px;">${escapeHtml(next)}</p>` +
      `<div>${button("Open your dashboard", input.dashboardUrl, true)}</div>`,
    {
      audience: "investor",
      subject,
      preheader: intro,
      context: input.companyName,
      reason: "You get this because iCFO matched you with this company on iCapOS.",
      lines: [NOT_A_BROKER_DEALER],
    },
  );
  return { subject, text, html };
}
