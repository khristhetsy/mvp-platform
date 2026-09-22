/**
 * The introduction email itself.
 *
 * Two buttons and a signed link, so an investor who registered as a guest can
 * answer without an account — most of a large event's attendees have none.
 */
import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { introToken, renderIntro, type IntroTemplate } from "@/lib/icfo-events/introductions-server";
import type { Recipient } from "@/lib/icfo-events/introductions";

const NAVY = "#0A1A40";
const BLUE = "#2563eb";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function button(href: string, label: string, primary: boolean): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;${
    primary ? `background:${BLUE};color:#ffffff;` : `background:#ffffff;color:${NAVY};border:1px solid #d5deea;`
  }">${esc(label)}</a>`;
}

export function introductionHtml(input: {
  body: string;
  respondUrl: string;
}): string {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#33415a;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:22px 0;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f2;">
      <tr><td style="padding:24px 30px;font-family:Arial,sans-serif;">
        ${paragraphs}
        <div style="margin-top:6px;">
          ${button(`${input.respondUrl}?a=yes`, "Accept the introduction →", true)}
          ${button(`${input.respondUrl}?a=no`, "Not right now", false)}
        </div>
        <p style="margin:14px 0 0;font-size:11.5px;color:#8a93a6;line-height:1.5;">
          Declining is silent — nobody is told who declined.
        </p>
      </td></tr>
      <tr><td style="padding:16px 30px;border-top:1px solid #e2e8f2;font-family:Arial,sans-serif;">
        <div style="font-size:11px;color:#8a93a6;line-height:1.5;">
          iCFO events are for education and community only. Nothing in this email is an offer to sell or a
          solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent,
          or registered investment adviser, and no funding outcome is promised.
        </div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/**
 * Send one introduction or follow-up.
 *
 * Returns false rather than throwing: a failed send is a row the follow-up
 * pass should try again tomorrow, not a crashed job.
 */
export async function sendIntroductionEmail(input: {
  introductionId: string;
  to: string;
  template: IntroTemplate;
  investor: Recipient;
  founder: Recipient;
  eventTitle: string;
  sharedSectors: string[];
  baseUrl: string;
}): Promise<boolean> {
  if (!input.to?.includes("@")) return false;

  const { subject, body } = renderIntro(input.template, {
    investor: input.investor,
    founder: input.founder,
    eventTitle: input.eventTitle,
    sharedSectors: input.sharedSectors,
  });

  return sendEmail({
    to: input.to,
    subject,
    html: introductionHtml({
      body,
      respondUrl: `${input.baseUrl.replace(/\/$/, "")}/e/intro/${introToken(input.introductionId)}`,
    }),
  });
}

// ── After an acceptance ───────────────────────────────────────────────────
// Two messages that did not exist while the platform minted its own room: the
// founder was never told he had been accepted, and nobody was ever told when
// the meeting was.

const FOOTER = `<p style="margin:14px 0 0;font-size:11.5px;color:#8a93a6;line-height:1.5;">
  iCFO events are for education and community only. Nothing in this email is an offer to sell or a
  solicitation to buy any security.
</p>`;

function shell(inner: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:22px 0;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f2;">
      <tr><td style="padding:24px 30px;font-family:Arial,sans-serif;">${inner}${FOOTER}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const para = (html: string) =>
  `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#33415a;">${html}</p>`;

/** The event, stated once, the same way in every message. */
function whenBlock(input: { eventTitle: string; when: string | null }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f2;border-radius:8px;margin:0 0 16px;">
    <tr><td style="padding:12px 14px;font-family:Arial,sans-serif;">
      <div style="font-size:14px;color:${NAVY};">${esc(input.eventTitle)}</div>
      ${input.when ? `<div style="font-size:13px;color:#33415a;margin-top:3px;">${esc(input.when)}</div>` : ""}
    </td></tr>
  </table>`;
}

/**
 * To the founder: you were accepted, now pick a time.
 *
 * The founder is the one pursuing, so the work of choosing a slot and bringing
 * a link falls to them rather than to the investor who has already said yes.
 */
export async function sendScheduleRequest(input: {
  to: string;
  founderName: string;
  investorName: string;
  investorCompany: string | null;
  eventTitle: string;
  when: string | null;
  scheduleUrl: string;
}): Promise<boolean> {
  if (!input.to?.includes("@")) return false;
  const who = input.investorCompany
    ? `${esc(input.investorName)} — ${esc(input.investorCompany)}`
    : esc(input.investorName);

  return sendEmail({
    to: input.to,
    subject: `${input.investorName} accepted — pick a time`,
    html: shell(
      para(`Hi ${esc(input.founderName.split(/\s+/)[0] || input.founderName)},`) +
      para(`${who} accepted your introduction.`) +
      whenBlock({ eventTitle: input.eventTitle, when: input.when }) +
      para("Choose a slot inside the event and add your meeting link. We will send both to them and put it in your calendars.") +
      `<div>${button(input.scheduleUrl, "Set the time →", true)}</div>` +
      para(`<span style="font-size:12px;color:#8a93a6;">They are waiting on you — nothing is booked until you pick.</span>`),
    ),
  });
}

/**
 * To the investor: here is when, and here is the link.
 *
 * Sent when the founder confirms, and again if they change it — the second one
 * has to be unmistakably a change, not a duplicate.
 */
export async function sendScheduledNotice(input: {
  to: string;
  investorName: string;
  founderName: string;
  founderCompany: string | null;
  eventTitle: string;
  when: string;
  meetingUrl: string;
  calendarUrl: string | null;
  rescheduleUrl: string;
  changed?: boolean;
}): Promise<boolean> {
  if (!input.to?.includes("@")) return false;
  const who = input.founderCompany
    ? `${esc(input.founderName)} — ${esc(input.founderCompany)}`
    : esc(input.founderName);

  return sendEmail({
    to: input.to,
    subject: input.changed
      ? `New time with ${input.founderName} — ${input.when}`
      : `${input.founderName} set a time — ${input.when}`,
    html: shell(
      para(`Hi ${esc(input.investorName.split(/\s+/)[0] || input.investorName)},`) +
      para(`${who} will meet you at <strong>${esc(input.when)}</strong>, during ${esc(input.eventTitle)}.`) +
      `<div>${button(input.meetingUrl, "Join the meeting →", true)}` +
      (input.calendarUrl ? button(input.calendarUrl, "Add to calendar", false) : "") +
      button(input.rescheduleUrl, "Ask for another time", false) +
      `</div>`,
    ),
  });
}
