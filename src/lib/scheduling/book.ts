import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { getGoogleBusyIntervals } from "@/lib/integrations/google-freebusy";
import { listEvents, createEvent, insertLocalEvent } from "@/lib/calendar/events";
import { loadAvailability } from "./store";
import { configFromSettings, expandWindows } from "./availability";
import type { CalendarEventRecord, TimeInterval } from "./types";

export interface BookSlotInput {
  hostId: string;
  /** id is null for guest bookers (no CapitalOS account). */
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
  const title = input.title?.trim() || `Meeting with ${bookerLabel}`;
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

  // Mirror onto the booker's own calendar (only if they have a CapitalOS account) —
  // local only, since the host's Google event already invites them.
  if (input.booker.id) {
    await insertLocalEvent(admin, input.booker.id, {
      title: hostName ? `${title} (${hostName})` : title,
      description: input.note ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      attendees: hostEmail ? [{ email: hostEmail, name: hostName ?? undefined }] : [],
      meetUrl: hostEvent.meet_url,
    });
  }

  return { event: hostEvent, meetUrl: hostEvent.meet_url, hostEmail, hostName };
}
