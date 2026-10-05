/**
 * Invitation and attendee emails. Pure: inputs in, subject and HTML out.
 *
 * House rules for the copy: no dashes as sentence punctuation, the iCFO
 * disclaimer on every email, and numbers only when they are real counts that
 * have passed their display minimum (see statTiles).
 */
import { OFFERS, LEAD_STAT, type InviteRole, type StatTile } from "@/lib/icfo-events/invitations/types";

export const DISCLAIMER =
  "iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

export const INVITE_STEPS = ["invite", "day3", "day7", "lastcall"] as const;
export type InviteStep = (typeof INVITE_STEPS)[number];

export const ATTENDEE_STEPS = ["confirm", "reminder_1d", "reminder_1h", "followup"] as const;
export type AttendeeStep = (typeof ATTENDEE_STEPS)[number];

export type EmailEvent = { title: string; dateLabel: string; url: string; joinUrl?: string | null };

const BLUE = "#1d5fd1";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "iCFO PE Expo — Paris | Dec 15" → "iCFO PE Expo". Pure. */
export function seriesName(titles: string[]): string {
  const base = titles.map((t) => t.split(/\s+[—–-]\s+|\s+\|\s+/)[0].trim()).filter(Boolean);
  if (!base.length) return "our upcoming event";
  return base.every((b) => b === base[0]) ? base[0] : "our upcoming events";
}

/** The lead tile for a role, when it carries a real count. Pure. */
function leadTile(role: InviteRole, tiles: StatTile[]): StatTile | null {
  const t = tiles.find((x) => x.key === LEAD_STAT[role]);
  return t && t.counted ? t : null;
}

/** Subject line for an invitation step. Pure. */
export function inviteSubject(role: InviteRole, step: InviteStep, series: string, tiles: StatTile[], override?: string | null): string {
  if (override && override.trim() && (step === "invite" || step === "day7")) return override.trim();
  const lead = leadTile(role, tiles);
  const base = (() => {
    if (lead && role === "founder") return `${lead.value} investors are registered for the ${series}`;
    if (lead && role === "investor") return `${lead.value} founders are registered for the ${series}`;
    if (role === "founder") return `Present to our investor network at the ${series}`;
    if (role === "investor") return `Prescreened founders and one on one meetings at the ${series}`;
    return `Founders and investors are meeting at the ${series}`;
  })();
  if (step === "day3") return role === "founder" ? `Presentation slots are limited at the ${series}` : role === "investor" ? `See who is presenting at the ${series}` : `Who is coming to the ${series}`;
  if (step === "day7") return `Your invitation to the ${series}`;
  if (step === "lastcall") return `Last call for the ${series}`;
  return base;
}

function statsBlock(tiles: StatTile[], imgUrl: string | null): string {
  if (!tiles.length) return "";
  // The image is drawn when the email is opened, so the numbers are current then.
  // The table below it is the fallback for clients that block images.
  if (imgUrl) {
    return `<div style="margin:16px 0;"><img src="${esc(imgUrl)}" width="520" alt="${esc(tiles.map((t) => `${t.label}: ${t.value}`).join(". "))}" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:10px;" /></div>`;
  }
  const cells = tiles.map((t, i) => `<td style="padding:10px;border:1px solid ${i === 0 ? BLUE : "#dfe4ec"};border-radius:8px;text-align:center;width:33%;"><div style="font-size:20px;font-weight:600;color:#1a4fb0;">${esc(t.value)}</div><div style="font-size:11px;color:#5b6b82;">${esc(t.label)}</div></td>`);
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 3) rows.push(`<tr>${cells.slice(i, i + 3).join("")}</tr>`);
  return `<table role="presentation" cellspacing="6" style="width:100%;margin:12px 0;">${rows.join("")}</table>`;
}

function offersBlock(role: InviteRole, offerKeys: string[]): string {
  const offers = OFFERS[role].filter((o) => offerKeys.includes(o.key));
  return offers.map((o) => `<p style="margin:8px 0;font-size:14px;line-height:1.5;"><b>${esc(o.label)}.</b> ${esc(o.blurb)}</p>`).join("");
}

function eventsBlock(events: EmailEvent[]): string {
  if (!events.length) return "";
  return `<p style="margin:12px 0 4px;font-size:13px;color:#5b6b82;">${events.length > 1 ? "Choose any of these" : "When"}</p>` +
    events.map((e) => `<p style="margin:2px 0;font-size:14px;"><b>${esc(e.title)}</b> · ${esc(e.dateLabel)}</p>`).join("");
}

function button(label: string, url: string): string {
  return `<p style="margin:20px 0;"><a href="${esc(url)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${esc(label)}</a></p>`;
}

function wrap(body: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#0f1b2d;max-width:560px;margin:0 auto;">${body}<p style="margin-top:24px;font-size:11px;color:#8a97ab;border-top:1px solid #dfe4ec;padding-top:10px;">${esc(DISCLAIMER)}</p></div>`;
}

export type InviteEmailInput = {
  role: InviteRole;
  step: InviteStep;
  firstName: string | null;
  events: EmailEvent[];
  offers: string[];
  tiles: StatTile[];
  statsImageUrl: string | null;
  ctaUrl: string;
  subjectOverride?: string | null;
  introOverride?: string | null;
};

export function renderInviteEmail(i: InviteEmailInput): { subject: string; html: string } {
  const series = seriesName(i.events.map((e) => e.title));
  const subject = inviteSubject(i.role, i.step, series, i.tiles, i.subjectOverride);
  const hi = `<p style="font-size:14px;">Hi ${esc(i.firstName || "there")},</p>`;
  const intro = (() => {
    if (i.introOverride && i.introOverride.trim() && (i.step === "invite" || i.step === "day7")) return esc(i.introOverride.trim());
    if (i.step === "day3") {
      return i.role === "founder"
        ? "Presentation slots for the investor network fill first. Here is who is already coming."
        : i.role === "investor"
          ? "The founder lineup is taking shape. Here is who is already coming."
          : "Here is who is already coming.";
    }
    if (i.step === "lastcall") return "Registration closes soon. Here is who will be there.";
    return "You're invited. Here's who is already coming.";
  })();
  const html = wrap(
    `${hi}<p style="font-size:14px;line-height:1.6;">${intro}</p>` +
    statsBlock(i.tiles, i.statsImageUrl) +
    offersBlock(i.role, i.offers) +
    eventsBlock(i.events) +
    button("Choose my events", i.ctaUrl),
  );
  return { subject, html };
}

export type AttendeeEmailInput = {
  step: AttendeeStep;
  attendeeType: string;
  firstName: string | null;
  event: EmailEvent;
  activities: string[];
  applyUrl?: string | null;
  signUpUrl: string;
};

export function renderAttendeeEmail(i: AttendeeEmailInput): { subject: string; html: string } {
  const hi = `<p style="font-size:14px;">Hi ${esc(i.firstName || "there")},</p>`;
  const when = `<p style="font-size:14px;"><b>${esc(i.event.title)}</b><br/>${esc(i.event.dateLabel)}</p>`;
  if (i.step === "confirm") {
    const acts = i.activities.length
      ? `<p style="margin:12px 0 4px;font-size:13px;color:#5b6b82;">You chose</p>${i.activities.map((a) => `<p style="margin:2px 0;font-size:14px;">${esc(a)}</p>`).join("")}`
      : "";
    const apply = i.applyUrl
      ? `<p style="font-size:14px;line-height:1.6;">To present, send your application and deck. Our team accepts or waitlists each application and emails you the result.</p>${button("Apply to present", i.applyUrl)}`
      : "";
    return {
      subject: `You're registered: ${i.event.title}`,
      html: wrap(`${hi}<p style="font-size:14px;">You're registered.</p>${when}${acts}${apply}${button("View the event", i.event.url)}`),
    };
  }
  if (i.step === "reminder_1d") {
    return {
      subject: `Tomorrow: ${i.event.title}`,
      html: wrap(`${hi}<p style="font-size:14px;">See you tomorrow.</p>${when}${button("Agenda and lobby", i.event.url)}`),
    };
  }
  if (i.step === "reminder_1h") {
    return {
      subject: `Starting in one hour: ${i.event.title}`,
      html: wrap(`${hi}<p style="font-size:14px;">We start in one hour.</p>${when}${button("Join now", i.event.joinUrl || i.event.url)}`),
    };
  }
  return {
    subject: `Thank you for joining ${i.event.title}`,
    html: wrap(
      `${hi}<p style="font-size:14px;line-height:1.6;">Thank you for joining. The replay and your meeting follow ups are on the event page.</p>${when}${button("Replay and follow ups", i.event.url)}` +
      `<p style="font-size:14px;line-height:1.6;">Keep the conversations going on iCapOS${i.attendeeType === "investor" ? ", free for investors" : ""}.</p>${button("Sign up on iCapOS", i.signUpUrl)}`,
    ),
  };
}
