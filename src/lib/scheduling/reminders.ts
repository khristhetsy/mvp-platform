import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail, type EmailBlock, type EmailSpec } from "@/lib/email/layout";
import { googleCalUrl } from "@/lib/icfo-events/calendar-links";

// calendar_events and scheduling_bookings aren't in the generated types — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const HOUR_MS = 60 * 60 * 1000;

export type ReminderTier = "24h" | "1h";

export type DueEvent = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  timezone: string;
  location: string | null;
  meet_url: string | null;
  attendees: Array<{ email: string; name?: string }> | null;
};

export type ReminderOwner = {
  email: string | null;
  full_name: string | null;
  role: string | null;
};

/** The structured booking behind a scheduler-booked event (host side only). */
export type ReminderBooking = {
  booker_name: string | null;
  booker_email: string | null;
  booker_phone: string | null;
  booker_company: string | null;
  note: string | null;
  answers: Array<{ label: string; value: string }> | null;
};

export type ReminderMessage = {
  to: string[];
  replyTo?: string;
  spec: EmailSpec;
};

function formatWhen(startTime: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(startTime));
  } catch {
    return new Date(startTime).toUTCString();
  }
}

function durationLabel(startTime: string, endTime: string | null): string | null {
  if (!endTime) return null;
  const min = Math.round((Date.parse(endTime) - Date.parse(startTime)) / 60000);
  if (!Number.isFinite(min) || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "Wed, Oct 22 · 10:30 – 11:00 AM PDT (30 min)" in the event's timezone. */
export function formatRange(startTime: string, endTime: string | null, timezone: string): string {
  const duration = durationLabel(startTime, endTime);
  try {
    const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(new Date(startTime));
    const time = (iso: string, withZone: boolean) =>
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", ...(withZone ? { timeZoneName: "short" } : {}) }).format(new Date(iso));
    const span = endTime && duration ? `${time(startTime, false)} – ${time(endTime, true)}` : time(startTime, true);
    return `${day} · ${span}${duration ? ` (${duration})` : ""}`;
  } catch {
    return new Date(startTime).toUTCString();
  }
}

function calendarPath(role: string | null): string | null {
  if (role === "founder") return "/founder/calendar";
  if (role === "investor") return "/investor/calendar";
  if (role === "admin" || role === "analyst") return "/admin/calendar";
  return null;
}

function bookingBlocks(booking: ReminderBooking): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  const name = booking.booker_name?.trim() || booking.booker_email?.trim() || null;
  if (name) {
    const meta = [
      ...(booking.booker_email ? [{ label: "Email", value: booking.booker_email }] : []),
      ...(booking.booker_phone ? [{ label: "Phone", value: booking.booker_phone }] : []),
    ];
    blocks.push({ type: "card", name, tagline: booking.booker_company?.trim() || null, meta });
  }
  const answers = (booking.answers ?? []).filter((a) => a.value?.trim());
  if (answers.length > 0) {
    blocks.push({
      type: "rows",
      title: "Reason for the call",
      items: answers.map((a) => ({ title: a.value, subtitle: a.label })),
    });
  }
  if (booking.note?.trim()) {
    const first = booking.booker_name?.trim().split(/\s+/)[0];
    blocks.push({ type: "quote", label: first ? `Note from ${first}` : "Note from the booker", text: booking.note.trim() });
  }
  return blocks;
}

/**
 * Build the reminder emails for one event. The owner (host) gets the full
 * picture: who booked, why, and their note — or the event notes when it wasn't
 * booked through the scheduler. Attendees get the meeting details only, with
 * replies routed to the owner.
 */
export function buildReminderMessages(input: {
  tier: ReminderTier;
  event: DueEvent;
  owner: ReminderOwner | null;
  booking: ReminderBooking | null;
}): ReminderMessage[] {
  const { tier, event, owner, booking } = input;
  const when = formatWhen(event.start_time, event.timezone);
  const range = formatRange(event.start_time, event.end_time, event.timezone);
  const subject = `Reminder: ${event.title}, ${tier === "24h" ? "tomorrow" : when}`;
  const preheader = `${when}${event.meet_url ? ". Google Meet link inside." : event.location ? `. ${event.location}` : ""}`;
  const headline = tier === "24h" ? "Your meeting is tomorrow" : "Your meeting starts in about an hour";
  const eyebrow = tier === "24h" ? "Reminder · Tomorrow" : "Reminder · In 1 hour";
  const primary = event.meet_url ? { label: "Join Google Meet", url: event.meet_url } : null;
  const footer = { reason: "You get this because this meeting is on your iCapOS calendar." };
  const ownerEmail = owner?.email?.trim().toLowerCase() || null;
  const ownerName = owner?.full_name?.trim() || null;

  const baseFacts = [
    { label: "Meeting", value: event.title },
    { label: "When", value: range },
    ...(event.location ? [{ label: "Where", value: event.location }] : []),
    ...(event.meet_url ? [{ label: "Video", value: event.meet_url }] : []),
  ];

  const attendeeEmails = Array.from(
    new Set((event.attendees ?? []).map((a) => a.email?.trim().toLowerCase()).filter((e): e is string => !!e && e !== ownerEmail)),
  );

  const messages: ReminderMessage[] = [];

  if (ownerEmail) {
    const blocks: EmailBlock[] = [];
    if (booking) {
      blocks.push(...bookingBlocks(booking));
    } else {
      const named = (event.attendees ?? []).filter((a) => a.email && a.email.trim().toLowerCase() !== ownerEmail);
      if (named.length > 0) {
        blocks.push({
          type: "rows",
          title: "Attendees",
          items: named.map((a) => ({ title: a.name?.trim() || a.email, subtitle: a.name?.trim() ? a.email : null })),
        });
      }
      if (event.description?.trim()) blocks.push({ type: "quote", label: "Notes", text: event.description.trim() });
    }
    blocks.push({ type: "facts", rows: baseFacts });
    const path = calendarPath(owner?.role ?? null);
    messages.push({
      to: [ownerEmail],
      spec: {
        audience: "shared",
        subject,
        preheader,
        context: "Scheduling",
        eyebrow,
        headline,
        intro: range,
        blocks,
        primary,
        secondary: path ? { label: "View in iCapOS", url: path } : null,
        footer,
      },
    });
  }

  if (attendeeEmails.length > 0) {
    const blocks: EmailBlock[] = [
      { type: "facts", rows: [...baseFacts, ...(ownerName ? [{ label: "Organizer", value: ownerName }] : [])] },
    ];
    if (ownerEmail) {
      blocks.push({ type: "paragraph", text: `Can't make it? Reply to this email to reach ${ownerName ?? "the organizer"}.` });
    }
    messages.push({
      to: attendeeEmails,
      replyTo: ownerEmail ?? undefined,
      spec: {
        audience: "shared",
        subject,
        preheader,
        context: "Scheduling",
        eyebrow,
        headline,
        intro: range,
        blocks,
        primary,
        secondary: {
          label: "Add to Google Calendar",
          url: googleCalUrl({
            title: event.title,
            startISO: event.start_time,
            endISO: event.end_time,
            details: event.meet_url ? `Join Google Meet: ${event.meet_url}` : null,
            location: event.meet_url ?? event.location,
          }),
        },
        footer,
      },
    });
  }

  return messages;
}

async function sendTier(
  admin: SupabaseClient,
  tier: ReminderTier,
  now: Date,
): Promise<{ processed: number; reminded: number }> {
  const nowISO = now.toISOString();
  const stampCol = tier === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";
  // 1h tier: events starting within the next hour. 24h tier: within the next 24h but
  // more than an hour away (so events under an hour get only the 1h reminder).
  const windowEnd = new Date(now.getTime() + (tier === "24h" ? 24 * HOUR_MS : HOUR_MS)).toISOString();
  const windowStart = tier === "24h" ? new Date(now.getTime() + HOUR_MS).toISOString() : nowISO;

  const { data } = await raw(admin)
    .from("calendar_events")
    .select("id, owner_id, title, description, start_time, end_time, timezone, location, meet_url, attendees")
    .eq("status", "confirmed").eq("all_day", false)
    .is(stampCol, null)
    .gte("start_time", windowStart).lte("start_time", windowEnd)
    .limit(200);
  const events = (data ?? []) as DueEvent[];
  if (events.length === 0) return { processed: 0, reminded: 0 };

  const ownerIds = Array.from(new Set(events.map((e) => e.owner_id)));
  const { data: owners } = await admin.from("profiles").select("id, email, full_name, role").in("id", ownerIds);
  const ownerById = new Map(
    ((owners ?? []) as Array<{ id: string } & ReminderOwner>).map((o) => [o.id, o]),
  );

  // Bookings made through the scheduler carry the contact, intake answers and note.
  const { data: bookingRows } = await raw(admin)
    .from("scheduling_bookings")
    .select("event_id, booker_name, booker_email, booker_phone, booker_company, note, answers")
    .in("event_id", events.map((e) => e.id))
    .eq("status", "confirmed");
  const bookingByEvent = new Map(
    ((bookingRows ?? []) as Array<{ event_id: string } & ReminderBooking>).map((b) => [b.event_id, b]),
  );

  let reminded = 0;
  const done: string[] = [];
  for (const event of events) {
    const messages = buildReminderMessages({
      tier,
      event,
      owner: ownerById.get(event.owner_id) ?? null,
      booking: bookingByEvent.get(event.id) ?? null,
    });
    let sent = false;
    for (const m of messages) {
      const mail = renderEmail(m.spec);
      const ok = await sendEmail({ to: m.to, replyTo: m.replyTo, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
      if (ok) sent = true;
    }
    if (sent) reminded += 1;
    done.push(event.id);
  }
  if (done.length > 0) {
    await raw(admin).from("calendar_events").update({ [stampCol]: nowISO }).in("id", done);
  }
  return { processed: events.length, reminded };
}

/**
 * Two-tier reminders for confirmed, timed meetings: one ~24h before and one ~1h before,
 * each stamped separately so it fires at most once. Best-effort per event.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<{ processed: number; reminded: number }> {
  const admin = createServiceRoleClient();
  const a = await sendTier(admin, "24h", now);
  const b = await sendTier(admin, "1h", now);
  return { processed: a.processed + b.processed, reminded: a.reminded + b.reminded };
}
