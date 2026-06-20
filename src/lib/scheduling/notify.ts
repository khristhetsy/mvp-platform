import { sendEmail } from "@/lib/email/send-email";

export interface BookingEmailInput {
  hostEmail: string | null;
  hostName: string | null;
  bookerEmail: string | null;
  bookerName: string | null;
  title: string;
  startTime: string;
  timezone: string;
  meetUrl: string | null;
}

function formatWhen(startTime: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(startTime));
  } catch {
    return new Date(startTime).toUTCString();
  }
}

function bodyHtml(opts: { greetingName: string | null; otherName: string | null; title: string; when: string; meetUrl: string | null }): string {
  const meet = opts.meetUrl
    ? `<p>Join Google Meet: <a href="${opts.meetUrl}">${opts.meetUrl}</a></p>`
    : "";
  return [
    `<p>Hi ${opts.greetingName ?? "there"},</p>`,
    `<p>Your meeting <strong>${opts.title}</strong>${opts.otherName ? ` with ${opts.otherName}` : ""} is confirmed.</p>`,
    `<p><strong>When:</strong> ${opts.when}</p>`,
    meet,
    `<p>This invitation was also added to your calendar.</p>`,
  ].join("");
}

/**
 * Send confirmation emails to both parties. Best-effort: silently no-ops when
 * RESEND_API_KEY isn't configured, and never throws into the booking flow.
 */
export async function sendBookingEmails(input: BookingEmailInput): Promise<void> {
  const when = formatWhen(input.startTime, input.timezone);

  const sends: Array<Promise<boolean>> = [];
  if (input.bookerEmail) {
    sends.push(
      sendEmail({
        to: input.bookerEmail,
        subject: `Confirmed: ${input.title}`,
        html: bodyHtml({ greetingName: input.bookerName, otherName: input.hostName, title: input.title, when, meetUrl: input.meetUrl }),
      }),
    );
  }
  if (input.hostEmail) {
    sends.push(
      sendEmail({
        to: input.hostEmail,
        subject: `New booking: ${input.title}`,
        html: bodyHtml({ greetingName: input.hostName, otherName: input.bookerName, title: input.title, when, meetUrl: input.meetUrl }),
      }),
    );
  }
  await Promise.allSettled(sends);
}
