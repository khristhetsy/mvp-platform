import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { getGoogleBusyIntervals } from "@/lib/integrations/google-freebusy";
import { listEvents, createEvent, insertLocalEvent } from "@/lib/calendar/events";
import { loadAvailability } from "./store";
import { configFromSettings, expandWindows } from "./availability";
import { createBooking } from "./bookings";
import { logActivity } from "@/lib/sales/activity";
import type { CalendarEventRecord, TimeInterval } from "./types";

export interface BookSlotInput {
  hostId: string;
  /** id is null for guest bookers (no iCapOS account). */
  booker: { id: string | null; email: string | null; name: string | null; phone?: string | null };
  startTime: string;
  endTime: string;
  timezone: string;
  title?: string;
  note?: string | null;
  answers?: Array<{ label: string; value: string }>;
}

export interface BookSlotResult {
  event: CalendarEventRecord;
  meetUrl: string | null;
  hostEmail: string | null;
  hostName: string | null;
}

/** Throws if [start,end] is outside the host's hours or conflicts with busy time. */
async function assertSlotOpen(hostId: string, startTime: string, endTime: string): Promise<void> {
  const admin = createServiceRoleClient();
  const sMs = Date.parse(startTime);
  const eMs = Date.parse(endTime);

  const settings = await loadAvailability(admin, hostId);
  const config = configFromSettings(settings, new Date(startTime));
  const windows = expandWindows(new Date(startTime), new Date(endTime), config);
  const covered = windows.some((w) => Date.parse(w.start) <= sMs && Date.parse(w.end) >= eMs);
  if (!covered) {
    throw new Error("That time is outside the host's available hours.");
  }

  const busy: TimeInterval[] = (await listEvents(admin, hostId, startTime, endTime)).map((e) => ({
    start: e.start_time,
    end: e.end_time,
  }));
  const token = await getValidGoogleAccessToken(hostId);
  if ("accessToken" in token && token.accessToken) {
    try {
      busy.push(...(await getGoogleBusyIntervals(token.accessToken, startTime, endTime)));
    } catch {
      // ignore
    }
  }

  const bufMs = settings.bufferMinutes * 60_000;
  const conflict = busy.some((b) => sMs < Date.parse(b.end) + bufMs && eMs > Date.parse(b.start) - bufMs);
  if (conflict) {
    throw new Error("That time is no longer available.");
  }
}

/**
 * Book a slot: create the meeting (with Meet) on the host's calendar with the
 * booker as attendee, then mirror it onto the booker's calendar. Returns the
 * host event plus the resolved Meet link and host identity (for notifications).
 */
export async function bookSlot(input: BookSlotInput): Promise<BookSlotResult> {
  await assertSlotOpen(input.hostId, input.startTime, input.endTime);

  const admin = createServiceRoleClient();
  const { data: hostProfile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", input.hostId)
    .single();
  const hostEmail = (hostProfile as { email: string | null } | null)?.email ?? null;
  const hostName = (hostProfile as { full_name: string | null } | null)?.full_name ?? null;

  const bookerLabel = input.booker.name ?? input.booker.email ?? "a member";
  // Auto titles embed the OTHER party's name, so each calendar shows who they're
  // meeting: the host's event says "Meeting with <booker>", the booker's mirror
  // says "Meeting with <host>" (below) — never the viewer's own name.
  const isAutoTitle = !input.title?.trim();
  const title = isAutoTitle ? `Meeting with ${bookerLabel}` : (input.title as string).trim();
  const description = [
    input.note ?? null,
    input.booker.name ? `Booked by: ${input.booker.name}` : null,
    input.booker.email ? `Email: ${input.booker.email}` : null,
    input.booker.phone ? `Phone: ${input.booker.phone}` : null,
    ...(input.answers ?? []).filter((a) => a.value).map((a) => `${a.label}: ${a.value}`),
  ].filter(Boolean).join("\n") || null;

  // Host event (authoritative) — creates the Google event + Meet, invites booker.
  const hostEvent = await createEvent(admin, input.hostId, {
    title,
    description,
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone,
    attendees: input.booker.email ? [{ email: input.booker.email, name: input.booker.name ?? undefined }] : [],
    addMeet: true,
  });

  // Mirror onto the booker's own calendar (only if they have a iCapOS account) —
  // local only, since the host's Google event already invites them.
  if (input.booker.id) {
    await insertLocalEvent(admin, input.booker.id, {
      title: isAutoTitle ? (hostName ? `Meeting with ${hostName}` : title) : (hostName ? `${title} (with ${hostName})` : title),
      description: input.note ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      attendees: hostEmail ? [{ email: hostEmail, name: hostName ?? undefined }] : [],
      meetUrl: hostEvent.meet_url,
    });
  }

  // Persist a structured booking (Calendly-style detail) + link it to the CRM and the
  // contact timeline. All best-effort: a failure here must never fail the booking.
  try {
    const answers = (input.answers ?? []).filter((a) => a.value);
    let contactCrmId: string | null = null;
    if (input.booker.email) {
      const { data } = await admin.from("crm_contacts").select("id, overrides").ilike("email", input.booker.email).maybeSingle();
      const contact = data as { id: string; overrides: Record<string, unknown> | null } | null;
      contactCrmId = contact?.id ?? null;
      // "How did you hear about us?" → fill lead source when it's blank.
      const heard = answers.find((a) => /how did you hear|hear about/i.test(a.label))?.value;
      if (contactCrmId && heard) {
        const overrides = contact?.overrides ?? {};
        if (!overrides.lead_source) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from("crm_contacts") as any).update({ overrides: { ...overrides, lead_source: heard } }).eq("id", contactCrmId);
        }
      }
    }

    await createBooking({
      host_id: input.hostId, event_id: hostEvent.id, event_type: title,
      booker_name: input.booker.name, booker_email: input.booker.email, booker_phone: input.booker.phone ?? null,
      contact_crm_id: contactCrmId,
      start_time: input.startTime, end_time: input.endTime, timezone: input.timezone,
      meet_url: hostEvent.meet_url, note: input.note ?? null, answers,
    });

    if (contactCrmId) {
      const when = new Date(input.startTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      await logActivity({ kind: "call", summary: `Booked: ${title} · ${when}`, actorId: input.hostId, contactCrmId });
    }
  } catch { /* never block a confirmed booking on bookkeeping */ }

  return { event: hostEvent, meetUrl: hostEvent.meet_url, hostEmail, hostName };
}
