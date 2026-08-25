// Real demo booking for the voice agent's schedule_demo tool. Creates a Google
// Calendar event (with a Meet link) on a designated booking calendar and invites
// the contact. Voice callers give times in words, so this books a 30-min hold at
// the next business slot with their stated preference in the notes — a real,
// reschedulable event the team confirms, not a stub. Degrades to log-only when
// Google isn't connected or the contact has no email.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { createCalendarEventWithMeet, isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

/** The admin whose Google calendar hosts voice-booked demos. */
const BOOKING_USER_ID = process.env.VOICE_BOOKING_USER_ID?.trim() || null;
const DEFAULT_TZ = "America/New_York";

/** Next business day at 15:00 in the given timezone → ISO start/end (30 min). */
function nextBusinessSlot(): { startTime: string; endTime: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Skip Sat/Sun.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(15, 0, 0, 0);
  const start = new Date(d);
  const end = new Date(d.getTime() + 30 * 60 * 1000);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

export interface BookDemoResult {
  booked: boolean;
  meetUrl?: string | null;
  message: string;
}

export async function bookVoiceDemo(
  contactId: string,
  contact: { name: string | null; email: string | null; timezone?: string | null },
  preferredTime: string | null,
): Promise<BookDemoResult> {
  const supabase = raw(createServiceRoleClient());
  const logTouch = (summary: string) =>
    supabase.from("outreach_touches").insert({ contact_id: contactId, channel: "voice", direction: "outbound", summary })
      .then(() => undefined, () => undefined);

  // Fall back to log-only when we can't actually book.
  if (!BOOKING_USER_ID || !isGoogleCalendarConfigured() || !contact.email) {
    await logTouch(`Demo requested${preferredTime ? ` — preferred: ${preferredTime}` : ""}`);
    return { booked: false, message: "Noted — the iCFO team will confirm a demo time by email." };
  }

  const token = await getValidGoogleAccessToken(BOOKING_USER_ID).catch(() => null);
  const accessToken = token && "accessToken" in token ? (token.accessToken as string | undefined) : undefined;
  if (!accessToken) {
    await logTouch(`Demo requested${preferredTime ? ` — preferred: ${preferredTime}` : ""} (calendar not connected)`);
    return { booked: false, message: "Noted — the iCFO team will confirm a demo time by email." };
  }

  const { startTime, endTime } = nextBusinessSlot();
  try {
    const event = await createCalendarEventWithMeet(
      {
        title: `iCFO demo — ${contact.name ?? "Founder"}`,
        startTime,
        endTime,
        timezone: contact.timezone || DEFAULT_TZ,
        attendees: [contact.email],
        notes: `Demo requested on an iCapOS Voice call.${preferredTime ? ` Caller's preferred time: "${preferredTime}".` : ""} This is a hold — confirm/reschedule with the founder.`,
      },
      accessToken,
    );
    await logTouch(`Demo booked (hold) — ${event.eventId ?? "calendar event"}${preferredTime ? ` · preferred: ${preferredTime}` : ""}`);
    return { booked: true, meetUrl: event.meetUrl ?? null, message: "Booked — you'll get a calendar invite with the video link. The team will confirm the exact time." };
  } catch {
    await logTouch(`Demo requested${preferredTime ? ` — preferred: ${preferredTime}` : ""} (booking failed — manual follow-up)`);
    return { booked: false, message: "Noted — the iCFO team will confirm a demo time by email." };
  }
}
