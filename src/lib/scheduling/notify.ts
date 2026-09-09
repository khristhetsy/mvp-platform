import { sendEmail } from "@/lib/email/send-email";
import { makeBookingToken } from "./tokens";

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

const BRAND = "iCFO Capital · iCapOS";
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

function bookingEmailHtml(opts: {
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
}): string {
  const row = (icon: string, main: string, sub?: string) => `
    <tr><td style="padding:6px 0;vertical-align:top;width:26px;color:#94a3b8;font-size:15px;">${icon}</td>
    <td style="padding:6px 0;font-size:13px;color:#111;">${main}${sub ? `<div style="font-size:11px;color:#64748b;margin-top:1px;">${sub}</div>` : ""}</td></tr>`;
  const meetRow = opts.meetUrl
    ? `<tr><td style="padding:8px 0 0;vertical-align:middle;width:26px;color:#94a3b8;font-size:15px;">▦</td>
       <td style="padding:8px 0 0;font-size:13px;color:#111;">Google Meet
       <a href="${esc(opts.meetUrl)}" style="display:inline-block;margin-left:8px;background:#2E78F5;color:#fff;text-decoration:none;font-size:12px;font-weight:600;border-radius:6px;padding:6px 14px;">Join</a></td></tr>`
    : "";
  const answers = opts.answers.filter((a) => a.value?.trim());
  const answersHtml = answers.length
    ? `<div style="margin:16px 24px 0;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:#94a3b8;margin-bottom:8px;">RESPONSES</div>
        ${answers.map((a) => `<div style="margin-bottom:9px;"><div style="font-size:12px;color:#64748b;">${esc(a.label)}</div><div style="font-size:13px;color:#111;margin-top:1px;">${esc(a.value)}</div></div>`).join("")}
      </div>`
    : "";
  const actions: string[] = [`<a href="${esc(opts.addToCalUrl)}" style="color:#185FA5;text-decoration:none;font-size:12px;">Add to calendar</a>`];
  if (opts.rescheduleUrl) actions.push(`<a href="${esc(opts.rescheduleUrl)}" style="color:#185FA5;text-decoration:none;font-size:12px;">Reschedule</a>`);
  if (opts.cancelUrl) actions.push(`<a href="${esc(opts.cancelUrl)}" style="color:#185FA5;text-decoration:none;font-size:12px;">Cancel</a>`);

  return `<div style="background:#eceef1;padding:20px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #dfe2e7;">
    <div style="text-align:center;padding:18px 0 14px;border-bottom:1px solid #eef1f5;font-size:15px;font-weight:600;color:#0C447C;">${BRAND}</div>
    <div style="text-align:center;padding:22px 24px 8px;">
      <div style="font-size:18px;font-weight:600;color:#111;">${esc(opts.heroTitle)}</div>
      <div style="font-size:13px;color:#64748b;margin-top:3px;">${esc(opts.heroSub)}</div>
    </div>
    <div style="margin:14px 24px;border:1px solid #e6e8ec;border-radius:10px;overflow:hidden;">
      <div style="background:#F7FAFE;padding:12px 16px;border-bottom:1px solid #eef1f5;">
        <div style="font-size:14px;font-weight:600;color:#111;">${esc(opts.title)}</div>
        ${opts.durationMin ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${opts.durationMin} minutes</div>` : ""}
      </div>
      <table style="width:100%;padding:6px 16px 12px;border-collapse:collapse;">
        ${row("&#128100;", esc(opts.inviteeName ?? "Invitee"), opts.inviteeEmail ? esc(opts.inviteeEmail) : undefined)}
        ${row("&#128197;", esc(opts.whenText), esc(opts.timezone))}
        ${meetRow}
      </table>
    </div>
    ${answersHtml}
    <div style="margin:16px 24px 0;padding-top:14px;border-top:1px solid #eef1f5;text-align:center;">
      ${actions.join('<span style="color:#cbd5e1;margin:0 8px;">·</span>')}
    </div>
    <div style="text-align:center;padding:16px 24px 20px;font-size:11px;color:#94a3b8;">iCapOS — Powered by iCFO Capital Global, Inc.</div>
  </div>
</div>`;
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
      html: bookingEmailHtml({ ...base, greetingName: input.bookerName, heroTitle: "You're scheduled", heroSub: "A calendar invitation has been sent to your email." }),
    }));
  }
  if (input.hostEmail) {
    sends.push(sendEmail({
      to: input.hostEmail,
      subject: `New booking: ${input.title}`,
      html: bookingEmailHtml({ ...base, greetingName: input.hostName, heroTitle: "New event scheduled", heroSub: `${input.bookerName ?? "Someone"} booked time with you.` }),
    }));
  }
  await Promise.allSettled(sends);
}

function cancelBodyHtml(opts: { greetingName: string | null; otherName: string | null; when: string }): string {
  return [
    `<p>Hi ${opts.greetingName ?? "there"},</p>`,
    `<p>Your meeting${opts.otherName ? ` with <strong>${opts.otherName}</strong>` : ""} on ${opts.when} has been cancelled.</p>`,
    `<p>The calendar invitation has been removed. Reply to this email if you'd like to find another time.</p>`,
  ].join("");
}

/** Notify both parties that a booking was cancelled. Best-effort, never throws. */
export async function sendBookingCancellation(input: Omit<BookingEmailInput, "meetUrl" | "answers" | "bookingId" | "endTime">): Promise<void> {
  const when = formatWhen(input.startTime, null, input.timezone);
  const sends: Array<Promise<boolean>> = [];
  if (input.bookerEmail) {
    sends.push(sendEmail({ to: input.bookerEmail, subject: `Cancelled: ${input.title}`, html: cancelBodyHtml({ greetingName: input.bookerName, otherName: input.hostName, when }) }));
  }
  if (input.hostEmail) {
    sends.push(sendEmail({ to: input.hostEmail, subject: `Cancelled: ${input.title}`, html: cancelBodyHtml({ greetingName: input.hostName, otherName: input.bookerName, when }) }));
  }
  await Promise.allSettled(sends);
}

export { bookingEmailHtml };
