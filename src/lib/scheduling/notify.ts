import { sendEmail } from "@/lib/email/send-email";
import { makeBookingToken } from "./tokens";
import { renderEmail, type RenderedEmail } from "@/lib/email/layout";

export interface BookingAnswerLite { label: string; value: string }

export interface BookingEmailInput {
  /** When present, the email carries Cancel + Reschedule links for this booking. */
  bookingId?: string | null;
  hostEmail: string | null;
  hostName: string | null;
  bookerEmail: string | null;
  bookerName: string | null;
  title: string;
  startTime: string;
  endTime?: string | null;
  timezone: string;
  meetUrl: string | null;
  answers?: BookingAnswerLite[];
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://icapos.com").replace(/\/+$/, "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatWhen(startTime: string, endTime: string | null | undefined, timezone: string): string {
  try {
    const start = new Date(startTime);
    const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const startTimeStr = timeFmt.format(start);
    if (endTime) {
      const endStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(endTime));
      return `${startTimeStr.replace(/(\d)\s?([A-Z]{2,})$/, "$1")} – ${endStr}, ${dayFmt.format(start)}`;
    }
    return `${startTimeStr}, ${dayFmt.format(start)}`;
  } catch {
    return new Date(startTime).toUTCString();
  }
}

function durationMin(startTime: string, endTime: string | null | undefined): number | null {
  if (!endTime) return null;
  const m = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
  return Number.isFinite(m) && m > 0 ? m : null;
}

/** Google Calendar "add event" template link (no API — a prefilled URL). */
function gcalUrl(title: string, startTime: string, endTime: string | null | undefined, meetUrl: string | null): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = endTime ?? new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${z(startTime)}/${z(end)}`,
    details: meetUrl ? `Join Google Meet: ${meetUrl}` : "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

type BookingEmailOpts = {
  greetingName: string | null;
  heroTitle: string;
  heroSub: string;
  title: string;
  inviteeName: string | null;
  inviteeEmail: string | null;
  whenText: string;
  timezone: string;
  durationMin: number | null;
  meetUrl: string | null;
  answers: BookingAnswerLite[];
  addToCalUrl: string;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
  subject?: string;
};

const FOOTER_REASON = "You get this because a meeting was booked through iCapOS scheduling.";
const linkStyle = "color:#1A6CE4;text-decoration:underline;font-size:13px;";

/** Booking confirmation on the shared layout. Pure. */
export function bookingEmail(opts: BookingEmailOpts): RenderedEmail {
  const first = opts.greetingName?.trim().split(/\s+/)[0] || null;
  const answers = opts.answers.filter((a) => a.value?.trim());
  const actions: string[] = [`<a href="${esc(opts.addToCalUrl)}" style="${linkStyle}">Add to calendar</a>`];
  if (opts.rescheduleUrl) actions.push(`<a href="${esc(opts.rescheduleUrl)}" style="${linkStyle}">Reschedule</a>`);
  if (opts.cancelUrl) actions.push(`<a href="${esc(opts.cancelUrl)}" style="${linkStyle}">Cancel</a>`);

  return renderEmail({
    audience: "shared",
    subject: opts.subject ?? opts.title,
    preheader: `${opts.whenText}${opts.meetUrl ? ". Google Meet link inside." : ""}`,
    context: "Scheduling",
    eyebrow: opts.heroTitle,
    headline: opts.title,
    intro: `${first ? `Hi ${first}, ` : ""}${opts.heroSub}`,
    blocks: [
      {
        type: "facts",
        rows: [
          { label: "When", value: opts.whenText },
          { label: "Time zone", value: opts.timezone },
          ...(opts.durationMin ? [{ label: "Length", value: `${opts.durationMin} minutes` }] : []),
          { label: "Invitee", value: [opts.inviteeName ?? "Invitee", opts.inviteeEmail].filter(Boolean).join(" · ") },
          ...(opts.meetUrl ? [{ label: "Video", value: "Google Meet" }] : []),
        ],
      },
      ...(answers.length ? [{ type: "rows" as const, title: "Responses", items: answers.map((a) => ({ title: a.label, subtitle: a.value })) }] : []),
      ...(opts.meetUrl ? [{ type: "html" as const, html: `<a href="${esc(opts.meetUrl)}" style="display:inline-block;background:#1A6CE4;color:#FFFFFF;border-radius:8px;padding:13px 22px;font-size:15px;font-weight:bold;text-decoration:none;">Join Google Meet</a>` }] : []),
      { type: "html", html: `<div>${actions.join('<span style="color:#C9D6EE;margin:0 8px;">·</span>')}</div>` },
    ],
    footer: { reason: FOOTER_REASON },
  });
}

function bookingEmailHtml(opts: BookingEmailOpts): string {
  return bookingEmail(opts).html;
}

/**
 * Send confirmation emails to both parties (Calendly-style layout). Best-effort:
 * silently no-ops when RESEND_API_KEY isn't configured, and never throws into the
 * booking flow. When bookingId is present the emails carry Cancel + Reschedule links.
 */
export async function sendBookingEmails(input: BookingEmailInput): Promise<void> {
  const whenText = formatWhen(input.startTime, input.endTime, input.timezone);
  const mins = durationMin(input.startTime, input.endTime);
  const addToCalUrl = gcalUrl(input.title, input.startTime, input.endTime, input.meetUrl);
  const cancelUrl = input.bookingId ? `${appUrl()}/schedule/cancel/${makeBookingToken(input.bookingId, "cancel")}` : null;
  const rescheduleUrl = input.bookingId ? `${appUrl()}/schedule/reschedule/${makeBookingToken(input.bookingId, "reschedule")}` : null;
  const answers = input.answers ?? [];

  const base = {
    title: input.title, whenText, timezone: input.timezone, durationMin: mins,
    meetUrl: input.meetUrl, answers, addToCalUrl, cancelUrl, rescheduleUrl,
    // The invitee in the card is always the booker (the person attending).
    inviteeName: input.bookerName, inviteeEmail: input.bookerEmail,
  };

  const sends: Array<Promise<boolean>> = [];
  if (input.bookerEmail) {
    sends.push(sendEmail({
      to: input.bookerEmail,
      subject: `Confirmed: ${input.title}`,
      html: bookingEmailHtml({ ...base, subject: `Confirmed: ${input.title}`, greetingName: input.bookerName, heroTitle: "You're scheduled", heroSub: "A calendar invitation has been sent to your email." }),
      fromName: "iCapOS",
    }));
  }
  if (input.hostEmail) {
    sends.push(sendEmail({
      to: input.hostEmail,
      subject: `New booking: ${input.title}`,
      html: bookingEmailHtml({ ...base, subject: `New booking: ${input.title}`, greetingName: input.hostName, heroTitle: "New event scheduled", heroSub: `${input.bookerName ?? "Someone"} booked time with you.` }),
      fromName: "iCapOS",
    }));
  }
  await Promise.allSettled(sends);
}

function cancelBodyHtml(opts: { greetingName: string | null; otherName: string | null; when: string; title?: string }): string {
  const first = opts.greetingName?.trim().split(/\s+/)[0] || null;
  return renderEmail({
    audience: "shared",
    subject: `Cancelled: ${opts.title ?? "your meeting"}`,
    preheader: `${opts.when}${opts.otherName ? ` with ${opts.otherName}` : ""} was cancelled.`,
    context: "Scheduling",
    eyebrow: "Booking cancelled",
    headline: "Your meeting was cancelled",
    intro: `${first ? `Hi ${first}, y` : "Y"}our meeting${opts.otherName ? ` with ${opts.otherName}` : ""} on ${opts.when} has been cancelled.`,
    blocks: [{ type: "paragraph", text: "The calendar invitation has been removed. Reply to this email if you'd like to find another time." }],
    footer: { reason: FOOTER_REASON },
  }).html;
}

/** Notify both parties that a booking was cancelled. Best-effort, never throws. */
export async function sendBookingCancellation(input: Omit<BookingEmailInput, "meetUrl" | "answers" | "bookingId" | "endTime">): Promise<void> {
  const when = formatWhen(input.startTime, null, input.timezone);
  const sends: Array<Promise<boolean>> = [];
  if (input.bookerEmail) {
    sends.push(sendEmail({ to: input.bookerEmail, subject: `Cancelled: ${input.title}`, html: cancelBodyHtml({ greetingName: input.bookerName, otherName: input.hostName, when, title: input.title }), fromName: "iCapOS" }));
  }
  if (input.hostEmail) {
    sends.push(sendEmail({ to: input.hostEmail, subject: `Cancelled: ${input.title}`, html: cancelBodyHtml({ greetingName: input.hostName, otherName: input.bookerName, when, title: input.title }), fromName: "iCapOS" }));
  }
  await Promise.allSettled(sends);
}

export { bookingEmailHtml };
