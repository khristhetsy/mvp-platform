/**
 * The introduction email itself.
 *
 * Two buttons and a signed link, so an investor who registered as a guest can
 * answer without an account — most of a large event's attendees have none.
 */
import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { introToken, renderIntro, type IntroTemplate } from "@/lib/icfo-events/introductions-server";
import type { Recipient } from "@/lib/icfo-events/introductions";

const NAVY = "#0A1A40";
const BLUE = "#2563eb";

export type Sender =
  /** Resend, from the platform address. Replies come back to the reply hook. */
  | { via: "icapos" }
  /**
   * The staff member's own Google account. Replies land in their inbox, where
   * the hook cannot see them — the board says so rather than pretending the
   * status will keep updating.
   */
  | { via: "gmail"; userId: string };

/** One door for both senders, so every introduction email can use either. */
async function deliver(sender: Sender, input: { to: string; subject: string; html: string }): Promise<boolean> {
  if (sender.via === "gmail") {
    const result = await sendViaGmail({
      userId: sender.userId,
      to: input.to,
      subject: input.subject,
      // Gmail wants a plain-text part too; the HTML is what people read.
      body: input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      html: input.html,
    });
    if ("error" in result) {
      console.error("[introductions] gmail send failed:", result.error.message);
      return false;
    }
    return true;
  }
  return sendEmail({ to: input.to, subject: input.subject, html: input.html });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function button(href: string, label: string, primary: boolean): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;${
    primary ? `background:${BLUE};color:#ffffff;` : `background:#ffffff;color:${NAVY};border:1px solid #d5deea;`
  }">${esc(label)}</a>`;
}

/** Says plainly that nothing happened, because the buttons below it won't. */
const TEST_BANNER = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px dashed #EF9F27;background:#FAEEDA;border-radius:8px;margin:0 0 16px;">
  <tr><td style="padding:10px 12px;font-family:Arial,sans-serif;font-size:12.5px;color:#633806;">
    Test send. The buttons below do nothing — nobody has been introduced.
  </td></tr>
</table>`;

/** Where a test's buttons point: a page that explains itself. */
export const TEST_RESPOND_PATH = "/e/intro/test";

/**
 * Why this email exists, in one sentence.
 *
 * Fixed rather than template copy: it belongs on the invitation, the peer
 * invitation, the founder follow-up and the digest, and four copies of a
 * sentence is four chances for one of them to drift or be edited away. The
 * event names itself, so a duplicated event cannot carry last year's date.
 */
export function purposeBlock(input: { eventTitle: string; when: string | null }): string {
  const where = input.when ? `${esc(input.eventTitle)}, ${esc(input.when)}` : esc(input.eventTitle);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f9ff;border-left:3px solid ${BLUE};margin:0 0 16px;">
    <tr><td style="padding:9px 12px;font-family:Arial,sans-serif;font-size:12.5px;color:#33415a;line-height:1.6;">
      This introduction is for networking at the upcoming iCFO Capital event — ${where}.
    </td></tr>
  </table>`;
}

export function introductionHtml(input: {
  body: string;
  respondUrl: string;
  test?: boolean;
  /** The fixed networking sentence. Omitted only when the event is unknown. */
  purpose?: { eventTitle: string; when: string | null } | null;
}): string {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#33415a;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:22px 0;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f2;">
      <tr><td style="padding:24px 30px;font-family:Arial,sans-serif;">
        ${input.test ? TEST_BANNER : ""}
        ${paragraphs}
        ${input.purpose ? purposeBlock(input.purpose) : ""}
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
  /** The event's date, for the networking sentence. */
  eventWhen?: string | null;
  sharedSectors: string[];
  baseUrl: string;
  /** A rehearsal: flagged in the subject, and its buttons lead nowhere. */
  test?: boolean;
  /** Who it comes from. Defaults to the platform address. */
  sender?: Sender;
}): Promise<boolean> {
  if (!input.to?.includes("@")) return false;

  const { subject, body } = renderIntro(input.template, {
    investor: input.investor,
    founder: input.founder,
    eventTitle: input.eventTitle,
    sharedSectors: input.sharedSectors,
  });

  const base = input.baseUrl.replace(/\/$/, "");
  return deliver(input.sender ?? { via: "icapos" }, {
    to: input.to,
    subject: input.test ? `[Test] ${subject}` : subject,
    html: introductionHtml({
      body,
      // A test carries no introduction to answer, so its buttons must not look
      // like they do — they lead to a page that says so.
      respondUrl: input.test ? `${base}${TEST_RESPOND_PATH}` : `${base}/e/intro/${introToken(input.introductionId)}`,
      test: input.test,
      purpose: { eventTitle: input.eventTitle, when: input.eventWhen ?? null },
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

/**
 * To the founder: they would like a different time.
 *
 * The founder still chooses — this reopens their picker rather than moving
 * anything, which is why the investor's button could never be the founder's
 * scheduling link.
 */
export async function sendRescheduleRequest(input: {
  to: string;
  founderName: string;
  investorName: string;
  eventTitle: string;
  currentWhen: string | null;
  note: string | null;
  scheduleUrl: string;
}): Promise<boolean> {
  if (!input.to?.includes("@")) return false;

  return sendEmail({
    to: input.to,
    subject: `${input.investorName} asked for a different time`,
    html: shell(
      para(`Hi ${esc(input.founderName.split(/\s+/)[0] || input.founderName)},`) +
      para(
        `${esc(input.investorName)} would like to meet at another time` +
        (input.currentWhen ? ` — ${esc(input.currentWhen)} does not work for them.` : ".") +
        ` The introduction stands; only the slot is open again.`,
      ) +
      (input.note
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-left:3px solid ${BLUE};margin:0 0 16px;">
             <tr><td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#33415a;">
               ${esc(input.note)}
             </td></tr>
           </table>`
        : "") +
      `<div>${button(input.scheduleUrl, "Pick another time →", true)}</div>`,
    ),
  });
}

// ── One email instead of forty ────────────────────────────────────────────
// An investor matched to forty founders was mailed forty times in one minute,
// each message perfectly reasonable on its own. The cap on the board limits
// how many go out; this changes what "several" looks like in an inbox.

export type DigestItem = {
  introductionId: string;
  founder: Recipient;
  sharedSectors: string[];
};

/**
 * The subject for a bundled send. One line, no templating — it is a count.
 *
 * `noun` because a digest may carry peers rather than founders, and calling
 * two investors "founders" is the mistake the peer template exists to avoid.
 */
export function digestSubject(count: number, eventTitle: string, noun = "founders"): string {
  return `${count} ${noun} worth meeting at ${eventTitle}`;
}

/**
 * One block per founder, each with its own pair of links.
 *
 * The links are the same per-introduction signed tokens the single email uses,
 * so accepting from row three lands on exactly the page row three would have
 * had on its own. Nothing new has to understand "accepted 3 of 40".
 */
export function introductionDigestHtml(input: {
  greeting: string;
  intro: string;
  rows: { name: string; meta: string; pitch: string | null; respondUrl: string }[];
  test?: boolean;
  /** Stated once, above the list — not on every row. */
  purpose?: { eventTitle: string; when: string | null } | null;
}): string {
  const rows = input.rows.map((r) => `
    <tr><td style="padding:14px 0;border-top:1px solid #e2e8f2;font-family:Arial,sans-serif;">
      <div style="font-size:14px;color:${NAVY};">${esc(r.name)}</div>
      ${r.meta ? `<div style="font-size:12.5px;color:#8a93a6;margin-top:2px;">${esc(r.meta)}</div>` : ""}
      ${r.pitch ? `<div style="font-size:13px;color:#33415a;margin-top:6px;line-height:1.55;">${esc(r.pitch)}</div>` : ""}
      <div style="margin-top:10px;">
        ${button(`${r.respondUrl}?a=yes`, "Accept", true)}
        ${button(`${r.respondUrl}?a=no`, "No thanks", false)}
      </div>
    </td></tr>`).join("");

  return shell(
    (input.test ? TEST_BANNER : "") +
    para(esc(input.greeting)) +
    para(esc(input.intro)) +
    (input.purpose ? purposeBlock(input.purpose) : "") +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
    `<p style="margin:16px 0 0;font-size:11.5px;color:#8a93a6;line-height:1.5;">
       Accept as many or as few as you like. Declining is silent — nobody is told who declined.
     </p>`,
  );
}

/**
 * Send one investor everything they matched with.
 *
 * Returns false rather than throwing: a failed send is a row the next pass can
 * try again, not a crashed job.
 */
export async function sendIntroductionDigest(input: {
  to: string;
  investorName: string;
  eventTitle: string;
  items: DigestItem[];
  baseUrl: string;
  /** The event's date, for the networking sentence. */
  eventWhen?: string | null;
  /** A rehearsal: flagged in the subject, and its buttons lead nowhere. */
  test?: boolean;
  /** Who it comes from. Defaults to the platform address. */
  sender?: Sender;
  /** "founders" when every row is a founder; "people" for a mixed or peer set. */
  noun?: string;
}): Promise<boolean> {
  if (!input.to?.includes("@") || input.items.length === 0) return false;

  const base = input.baseUrl.replace(/\/$/, "");
  const rows = input.items.map((item) => {
    const meta = [
      item.founder.company,
      item.founder.stage,
      item.founder.raising,
      item.sharedSectors.join(", "),
    ].map((v) => (v ?? "").trim()).filter(Boolean).join(" · ");
    return {
      name: item.founder.name,
      meta,
      pitch: item.founder.pitch?.trim() || null,
      respondUrl: input.test ? `${base}${TEST_RESPOND_PATH}` : `${base}/e/intro/${introToken(item.introductionId)}`,
    };
  });

  const noun = input.noun ?? "founders";
  const subject = digestSubject(input.items.length, input.eventTitle, noun);
  return deliver(input.sender ?? { via: "icapos" }, {
    to: input.to,
    subject: input.test ? `[Test] ${subject}` : subject,
    html: introductionDigestHtml({
      greeting: `Hi ${input.investorName.split(/\s+/)[0] || input.investorName},`,
      intro: noun === "founders"
        ? `${input.items.length} founders at ${input.eventTitle} match what you back. Accept the ones you want to meet — each sends you their time and a link.`
        : `${input.items.length} people at ${input.eventTitle} share your sectors. Accept the ones you want to meet — each sends you a time and a link.`,
      rows,
      test: input.test,
      purpose: { eventTitle: input.eventTitle, when: input.eventWhen ?? null },
    }),
  });
}
