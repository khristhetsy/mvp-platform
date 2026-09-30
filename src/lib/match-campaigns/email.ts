/**
 * The founder Match email (approved mockup, step 5). Short email, full list on the web
 * match page, because email apps can't expand content on click.
 *
 * Wording rule: investors MATCH the founder. Never "interested": investors are not
 * contacted by this feature. Names are masked before payment (open decision settled).
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";
import { NOT_A_BROKER_DEALER } from "@/lib/email/layout";
import { fillSubject, type TopMatch } from "./core";

export type MatchEmailInput = {
  firstName: string | null;
  company: string;
  industry: string | null;
  stage: string | null;
  matchCount: number;
  networkLabel: string;
  top: TopMatch[];
  subjectTemplate: string;
  pageUrl: string;
  callUrl: string;
  introUrl: string;
};

const MUTED = "#5A6B8C";

function typeLabel(t: string | null): string {
  return (t ?? "").trim() || "Investor";
}

export function describeTopMatch(m: TopMatch): { title: string; meta: string } {
  const sector = m.sectors[0] ?? null;
  const stage = m.stages.slice(0, 2).join(", ") || null;
  return {
    title: [typeLabel(m.investor_type), sector].filter(Boolean).join(" · "),
    meta: [stage ? `Stage fit: ${stage}` : null, m.check_band ? `Check ${m.check_band}` : null].filter(Boolean).join(" · "),
  };
}

export function renderMatchEmail(input: MatchEmailInput): { subject: string; html: string; text: string } {
  const subject = fillSubject(input.subjectTemplate, { match_count: input.matchCount, company: input.company });
  const shown = input.top.slice(0, 3);
  const remaining = Math.max(0, input.matchCount - shown.length);
  const header = [input.company, input.industry, input.stage].filter(Boolean).join(" · ");
  const greet = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const note =
    `We have a network of ${input.networkLabel} investors. Here are your current matches: ` +
    `${input.matchCount} ${input.matchCount === 1 ? "investor fits" : "investors fit"} your industry and stage. ` +
    `Schedule a call with us to walk through them, or get introduced today to see who they are and request introductions.`;
  const lock = remaining > 0
    ? `${remaining} more ${remaining === 1 ? "match" : "matches"}. Contact info and Request introduction unlock with a plan.`
    : "Contact info and Request introduction unlock with a plan.";

  const cards = shown.map((m) => {
    const d = describeTopMatch(m);
    const fit = Math.round(m.fit);
    return (
      `<table role="presentation" style="width:100%;border:1px solid #E3E8F2;border-radius:8px;border-collapse:separate;margin:0 0 8px;"><tr>` +
      `<td style="padding:10px 12px;"><div style="font-weight:bold;font-size:14px;letter-spacing:.5px;color:${MUTED};">Name hidden</div>` +
      `<div style="font-size:13px;">${escapeHtml(d.title)}</div>` +
      (d.meta ? `<div style="font-size:12px;color:${MUTED};">${escapeHtml(d.meta)}</div>` : "") +
      `</td><td style="padding:10px 12px;text-align:right;white-space:nowrap;"><span style="background:#E6F1FB;color:#0C447C;font-size:12px;padding:3px 8px;border-radius:6px;">${fit}% match</span></td>` +
      `</tr></table>`
    );
  }).join("");

  const inner = [
    `<h2 style="margin:0 0 4px;font-size:20px;">Your investor matches</h2>`,
    `<p style="margin:0 0 14px;color:${MUTED};font-size:13px;">${escapeHtml(header)}</p>`,
    `<p style="margin:0 0 10px;">${escapeHtml(greet)}</p>`,
    `<p style="margin:0 0 14px;">${escapeHtml(note)}</p>`,
    cards,
    `<p style="margin:6px 0 8px;font-size:12px;color:${MUTED};border:1px dashed #C9D1E0;border-radius:6px;padding:8px 10px;">${escapeHtml(lock)}</p>`,
    `<p style="margin:0 0 16px;"><a href="${escapeHtml(input.pageUrl)}" style="color:#1A6CE4;font-weight:bold;">See all ${input.matchCount} matches</a></p>`,
    `<div>${button("Schedule a call with us", input.callUrl, true)}${button("Get introduced today", input.introUrl, false)}</div>`,
  ].join("");

  const html = shell(inner, {
    audience: "founder",
    subject,
    preheader: `${input.matchCount} investors in our network match ${input.company}.`,
    reason: "You're receiving this because your company is in the iCapOS founder network.",
    lines: [
      "Plans from $49/month.",
      "We use your business contact details to share relevant investor matches. See icapos.com/privacy.",
      NOT_A_BROKER_DEALER,
    ],
  });

  const text = [
    "Your investor matches",
    header,
    "",
    greet,
    note,
    "",
    ...shown.map((m) => {
      const d = describeTopMatch(m);
      return `Name hidden: ${d.title} (${Math.round(m.fit)}% match)${d.meta ? `. ${d.meta}` : ""}`;
    }),
    "",
    lock,
    `See all ${input.matchCount} matches: ${input.pageUrl}`,
    `Schedule a call with us: ${input.callUrl}`,
    `Get introduced today: ${input.introUrl}`,
    "",
    "Plans from $49/month.",
    NOT_A_BROKER_DEALER,
  ].join("\n");

  return { subject, html, text };
}
