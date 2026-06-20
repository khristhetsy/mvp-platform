import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CalendarEventRecord } from "@/lib/scheduling/types";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import {
  cancelCalendarEvent,
  createCalendarEventWithMeet,
  updateCalendarEvent,
} from "@/lib/integrations/google-calendar";

// calendar_events isn't in the generated Database types yet; use a raw client
// reference (mirrors the tips / founder-journey pattern).
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  allDay?: boolean;
  location?: string | null;
  attendees?: Array<{ email: string; name?: string }>;
  /** Attach a Google Meet link (requires a connected Google account). */
  addMeet?: boolean;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  location?: string | null;
  attendees?: Array<{ email: string; name?: string }>;
}

const COLUMNS =
  "id, owner_id, title, description, start_time, end_time, timezone, all_day, location, attendees, meet_url, source, external_provider, external_event_id, status, created_at, updated_at";

/** Events for an owner overlapping [fromISO, toISO], excluding cancelled. */
export async function listEvents(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  fromISO: string,
  toISO: string,
): Promise<CalendarEventRecord[]> {
  const { data } = await raw(supabase)
    .from("calendar_events")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .eq("status", "confirmed")
    .lt("start_time", toISO)
    .gt("end_time", fromISO)
    .order("start_time", { ascending: true });
  return (data ?? []) as CalendarEventRecord[];
}

/** Try to mirror the event to Google Calendar; returns external refs or nulls. */
async function syncCreateToGoogle(
  ownerId: string,
  input: CreateEventInput,
): Promise<{ eventId: string | null; meetUrl: string | null }> {
  if (input.allDay) return { eventId: null, meetUrl: null };
  const token = await getValidGoogleAccessToken(ownerId);
  if (!("accessToken" in token) || !token.accessToken) return { eventId: null, meetUrl: null };
  try {
    const result = await createCalendarEventWithMeet(
      {
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
        attendees: (input.attendees ?? []).map((a) => a.email),
        notes: input.description ?? null,
      },
      token.accessToken,
    );
    return { eventId: result.eventId, meetUrl: result.meetUrl };
  } catch {
    // Non-fatal: keep the local event even if Google sync fails.
    return { eventId: null, meetUrl: null };
  }
}

export async function createEvent(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: CreateEventInput,
): Promise<CalendarEventRecord> {
  const wantsGoogle = Boolean(input.addMeet) || (input.attendees?.length ?? 0) > 0;
  const external = wantsGoogle
    ? await syncCreateToGoogle(ownerId, input)
    : { eventId: null, meetUrl: null };

  const row = {
    owner_id: ownerId,
    title: input.title,
    description: input.description ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    timezone: input.timezone,
    all_day: input.allDay ?? false,
    location: input.location ?? null,
    attendees: input.attendees ?? [],
    meet_url: external.meetUrl,
    source: external.eventId ? "google" : "capitalos",
    external_provider: external.eventId ? "google" : null,
    external_event_id: external.eventId,
    status: "confirmed",
  };

  const { data, error } = await raw(supabase)
    .from("calendar_events")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message ?? "Unable to create event.");
  return data as CalendarEventRecord;
}

/**
 * Insert a local-only event (no Google sync). Used for the booker's mirror of a
 * booked meeting — the host's Google event already invites them, so we must not
 * create a second Google event (which would mint a duplicate Meet link).
 */
export async function insertLocalEvent(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: CreateEventInput & { meetUrl?: string | null },
): Promise<CalendarEventRecord> {
  const row = {
    owner_id: ownerId,
    title: input.title,
    description: input.description ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    timezone: input.timezone,
    all_day: input.allDay ?? false,
    location: input.location ?? null,
    attendees: input.attendees ?? [],
    meet_url: input.meetUrl ?? null,
    source: "capitalos",
    external_provider: null,
    external_event_id: null,
    status: "confirmed",
  };
  const { data, error } = await raw(supabase)
    .from("calendar_events")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message ?? "Unable to create event.");
  return data as CalendarEventRecord;
}

export async function updateEvent(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  id: string,
  input: UpdateEventInput,
): Promise<CalendarEventRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.startTime !== undefined) patch.start_time = input.startTime;
  if (input.endTime !== undefined) patch.end_time = input.endTime;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.location !== undefined) patch.location = input.location;
  if (input.attendees !== undefined) patch.attendees = input.attendees;

  const { data, error } = await raw(supabase)
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message ?? "Unable to update event.");
  const record = data as CalendarEventRecord;

  // Best-effort Google sync.
  if (record.external_event_id) {
    const token = await getValidGoogleAccessToken(ownerId);
    if ("accessToken" in token && token.accessToken) {
      try {
        await updateCalendarEvent(
          record.external_event_id,
          {
            title: record.title,
            startTime: record.start_time,
            endTime: record.end_time,
            timezone: record.timezone,
            notes: record.description,
            attendees: record.attendees.map((a) => a.email),
          },
          token.accessToken,
        );
      } catch {
        // ignore — local record is the source of truth
      }
    }
  }
  return record;
}

export async function cancelEvent(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  id: string,
): Promise<void> {
  const { data, error } = await raw(supabase)
    .from("calendar_events")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("external_event_id")
    .single();
  if (error) throw new Error(error.message ?? "Unable to cancel event.");

  const externalId = (data as { external_event_id: string | null })?.external_event_id;
  if (externalId) {
    const token = await getValidGoogleAccessToken(ownerId);
    if ("accessToken" in token && token.accessToken) {
      try {
        await cancelCalendarEvent(externalId, token.accessToken);
      } catch {
        // ignore
      }
    }
  }
}
