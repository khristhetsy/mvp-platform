// iCFO Events — data access. Takes a Supabase client (service-role for staff
// writes/reads; the public reads use the cookie client and rely on RLS).
// Tables aren't in generated types yet — local raw() cast.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  CreateEventInput,
  UpdateEventInput,
} from "./schemas";
import { slugify } from "./schemas";
import type {
  EventRecord,
  EventSectorTrack,
  EventSession,
  EventStatus,
  EventWithDetail,
} from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

// ── row → domain mappers ──────────────────────────────────────────────────────

type EventRow = Record<string, unknown>;

function mapEvent(r: EventRow): EventRecord {
  return {
    id: String(r.id),
    title: String(r.title),
    slug: String(r.slug),
    summary: (r.summary as string | null) ?? null,
    status: r.status as EventStatus,
    format: r.format as EventRecord["format"],
    visibility: r.visibility as EventRecord["visibility"],
    startsAt: (r.starts_at as string | null) ?? null,
    endsAt: (r.ends_at as string | null) ?? null,
    coverPath: (r.cover_path as string | null) ?? null,
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

function mapSector(r: EventRow): EventSectorTrack {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    sectorSlug: String(r.sector_slug),
    label: String(r.label),
  };
}

function mapSession(r: EventRow): EventSession {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    sectorSlug: (r.sector_slug as string | null) ?? null,
    title: String(r.title),
    abstract: (r.abstract as string | null) ?? null,
    type: r.type as EventSession["type"],
    status: r.status as EventSession["status"],
    startsAt: (r.starts_at as string | null) ?? null,
    endsAt: (r.ends_at as string | null) ?? null,
    videoProvider: (r.video_provider as string | null) ?? null,
    videoRef: (r.video_ref as string | null) ?? null,
    recordingPath: (r.recording_path as string | null) ?? null,
    position: Number(r.position ?? 0),
  };
}

// ── reads ─────────────────────────────────────────────────────────────────────

/** Admin list: every event regardless of status. */
export async function listAllEvents(supabase: SupabaseClient<Database>): Promise<EventRecord[]> {
  const { data, error } = await raw(supabase)
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

/** Public list: only published/live/ended (RLS also enforces this). */
export async function listPublicEvents(supabase: SupabaseClient<Database>): Promise<EventRecord[]> {
  const { data, error } = await raw(supabase)
    .from("events")
    .select("*")
    .in("status", ["published", "live", "ended"])
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

/** Published events that have a track in the given sector. */
export async function listEventsBySector(
  supabase: SupabaseClient<Database>,
  sectorSlug: string,
): Promise<EventRecord[]> {
  const { data, error } = await raw(supabase)
    .from("event_sectors")
    .select("events:event_id(*)")
    .eq("sector_slug", sectorSlug);
  if (error) throw new Error(error.message);

  const events = ((data ?? []) as EventRow[])
    .map((row) => row.events as EventRow | null)
    .filter((e): e is EventRow => e !== null)
    .map(mapEvent)
    .filter((e) => ["published", "live", "ended"].includes(e.status));

  // De-dupe (an event could match once per sector row) and sort by start.
  const seen = new Set<string>();
  return events
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}

async function loadSectors(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventSectorTrack[]> {
  const { data } = await raw(supabase)
    .from("event_sectors")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapSector);
}

async function loadSessions(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventSession[]> {
  const { data } = await raw(supabase)
    .from("sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  return (data ?? []).map(mapSession);
}

export async function getEventBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<EventWithDetail | null> {
  const { data, error } = await raw(supabase).from("events").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const event = mapEvent(data as EventRow);
  const [sectors, sessions] = await Promise.all([
    loadSectors(supabase, event.id),
    loadSessions(supabase, event.id),
  ]);
  return { ...event, sectors, sessions };
}

export async function getEventById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<EventWithDetail | null> {
  const { data, error } = await raw(supabase).from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const event = mapEvent(data as EventRow);
  const [sectors, sessions] = await Promise.all([
    loadSectors(supabase, event.id),
    loadSessions(supabase, event.id),
  ]);
  return { ...event, sectors, sessions };
}

// ── writes (staff, service-role) ──────────────────────────────────────────────

async function uniqueSlug(supabase: SupabaseClient<Database>, base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // Probe for collisions; append -2, -3, … until free.
  for (;;) {
    const { data } = await raw(supabase).from("events").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`.slice(0, 110);
  }
}

async function replaceSectors(
  supabase: SupabaseClient<Database>,
  eventId: string,
  sectors: CreateEventInput["sectors"],
): Promise<void> {
  await raw(supabase).from("event_sectors").delete().eq("event_id", eventId);
  if (sectors.length === 0) return;
  await raw(supabase)
    .from("event_sectors")
    .insert(sectors.map((s) => ({ event_id: eventId, sector_slug: s.sectorSlug, label: s.label })));
}

export async function createEvent(
  supabase: SupabaseClient<Database>,
  createdBy: string,
  input: CreateEventInput,
): Promise<EventRecord> {
  const slug = await uniqueSlug(supabase, slugify(input.title));
  const { data, error } = await raw(supabase)
    .from("events")
    .insert({
      title: input.title,
      slug,
      summary: input.summary ?? null,
      format: input.format,
      visibility: input.visibility,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const event = mapEvent(data as EventRow);
  await replaceSectors(supabase, event.id, input.sectors);
  return event;
}

export async function updateEvent(
  supabase: SupabaseClient<Database>,
  id: string,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.format !== undefined) patch.format = input.format;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;

  const { data, error } = await raw(supabase)
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  if (input.sectors !== undefined) await replaceSectors(supabase, id, input.sectors);
  return mapEvent(data as EventRow);
}

/** Move an event between lifecycle states. Sets published_at on first publish. */
export async function setEventStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: EventStatus,
): Promise<EventRecord> {
  const patch: Record<string, unknown> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  const { data, error } = await raw(supabase)
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEvent(data as EventRow);
}
