/**
 * The follow-up to an investor who accepted: a link to book on the founder's
 * own scheduling page.
 *
 * One sender for the daily run and for the founder's Follow up button, so both
 * say the same thing.
 */
import "server-only";

import { introDetail } from "@/lib/icfo-events/introductions-server";
import { sendBookingFollowUp } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

export type BookingFollowUpResult = { ok: true } | { ok: false; error: string; noAccount?: boolean };

export async function sendBookingFollowUpFor(introId: string): Promise<BookingFollowUpResult> {
  const detail = await introDetail(introId);
  if (!detail) return { ok: false, error: "That introduction no longer exists." };
  if (!detail.investor?.email) return { ok: false, error: "This investor has no email on file." };
  const hostId = detail.founder?.profileId;
  if (!hostId) return { ok: false, error: "Create your founder account to follow up.", noAccount: true };

  const sent = await sendBookingFollowUp({
    to: detail.investor.email,
    investorName: detail.investor.name,
    founderName: detail.founder?.name ?? "the founder",
    founderCompany: detail.founder?.company ?? null,
    eventTitle: detail.event?.title ?? "the event",
    when: detail.event?.startsAt ? formatSlot(detail.event.startsAt, detail.event.timezone) : null,
    bookUrl: `${BASE_URL.replace(/\/$/, "")}/schedule/${hostId}`,
  });
  return sent ? { ok: true } : { ok: false, error: "The email could not be sent." };
}
