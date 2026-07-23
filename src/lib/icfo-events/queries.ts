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
import { sanitizeBannerHtml, normalizeBannerBg } from "./sanitize-html";
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
    coverOverlay: Number(r.cover_overlay ?? 55),
    coverFocal: (r.cover_focal as string | null) ?? "center",
    bannerTitle: (r.banner_title as string | null) ?? null,
    bannerHtml: (r.banner_html as string | null) ?? null,
    bannerBg: (r.banner_bg as string | null) ?? "indigo",
    showCountdown: r.show_countdown === undefined ? true : Boolean(r.show_countdown),
    organizerName: (r.organizer_name as string | null) ?? null,
    organizerPhone: (r.organizer_phone as string | null) ?? null,
    organizerEmail: (r.organizer_email as string | null) ?? null,
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
    hostSponsorId: (r.host_sponsor_id as string | null) ?? null,
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

export type DuplicateEventOptions = {
  /** New title; defaults to "Copy of <source title>". */
  title?: string;
  /** Copy banner, cover, and organiser details (default true). */
  branding?: boolean;
  /** Copy the agenda / sessions, with schedule dates cleared (default true). */
  sessions?: boolean;
  /** Copy sponsor links and their placements (default true). */
  sponsors?: boolean;
};

/**
 * Deep-copy an existing event into a fresh DRAFT so organisers can reuse a past
 * setup instead of rebuilding. Sector tracks are always copied (an event needs
 * at least one). Schedule dates and recordings are cleared so they can be set
 * for the new run. Attendee data — registrations, poll results, analytics — is
 * never copied and stays with the original.
 */
export async function duplicateEvent(
  supabase: SupabaseClient<Database>,
  createdBy: string,
  sourceId: string,
  options: DuplicateEventOptions = {},
): Promise<EventRecord> {
  const { data: src, error: srcErr } = await raw(supabase)
    .from("events")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (srcErr) throw new Error(srcErr.message);
  if (!src) throw new Error("Source event not found.");
  const source = src as EventRow;

  const title = options.title?.trim() || `Copy of ${String(source.title)}`;
  const slug = await uniqueSlug(supabase, slugify(title));
  const withBranding = options.branding !== false;

  const insert: Record<string, unknown> = {
    title,
    slug,
    summary: (source.summary as string | null) ?? null,
    format: source.format,
    visibility: source.visibility,
    status: "draft",
    starts_at: null,
    ends_at: null,
    created_by: createdBy,
  };
  if (withBranding) {
    Object.assign(insert, {
      cover_path: source.cover_path ?? null,
      cover_overlay: source.cover_overlay ?? 55,
      cover_focal: source.cover_focal ?? "center",
      banner_title: source.banner_title ?? null,
      banner_html: source.banner_html ?? null,
      banner_bg: source.banner_bg ?? "indigo",
      show_countdown: source.show_countdown ?? true,
      organizer_name: source.organizer_name ?? null,
      organizer_phone: source.organizer_phone ?? null,
      organizer_email: source.organizer_email ?? null,
    });
  }

  const { data: created, error: insErr } = await raw(supabase)
    .from("events")
    .insert(insert)
    .select("*")
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? "Failed to create the copy.");
  const event = mapEvent(created as EventRow);
  const newId = event.id;

  // Sector tracks — always (an event must carry at least one).
  const { data: sectors } = await raw(supabase)
    .from("event_sectors")
    .select("sector_slug,label")
    .eq("event_id", sourceId);
  if (sectors && sectors.length) {
    await raw(supabase)
      .from("event_sectors")
      .insert((sectors as EventRow[]).map((s) => ({ event_id: newId, sector_slug: s.sector_slug, label: s.label })));
  }

  // Sponsor links (the sponsor records themselves are shared, so we re-link).
  const copySponsors = options.sponsors !== false;
  if (copySponsors) {
    const { data: links } = await raw(supabase)
      .from("event_sponsors")
      .select("sponsor_id,placement")
      .eq("event_id", sourceId);
    if (links && links.length) {
      await raw(supabase)
        .from("event_sponsors")
        .insert((links as EventRow[]).map((l) => ({ event_id: newId, sponsor_id: l.sponsor_id, placement: l.placement })));
    }
  }

  // Sessions / agenda — schedule and recordings reset for the new run.
  if (options.sessions !== false) {
    const { data: sess } = await raw(supabase)
      .from("sessions")
      .select("*")
      .eq("event_id", sourceId)
      .order("position", { ascending: true });
    if (sess && sess.length) {
      await raw(supabase).from("sessions").insert(
        (sess as EventRow[]).map((s) => ({
          event_id: newId,
          sector_slug: (s.sector_slug as string | null) ?? null,
          title: s.title,
          abstract: (s.abstract as string | null) ?? null,
          type: s.type,
          status: s.status,
          starts_at: null,
          ends_at: null,
          video_provider: (s.video_provider as string | null) ?? null,
          video_ref: (s.video_ref as string | null) ?? null,
          recording_path: null,
          host_sponsor_id: copySponsors ? ((s.host_sponsor_id as string | null) ?? null) : null,
          position: Number(s.position ?? 0),
        })),
      );
    }
  }

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
  if (input.bannerTitle !== undefined) patch.banner_title = input.bannerTitle;
  if (input.bannerHtml !== undefined) patch.banner_html = sanitizeBannerHtml(input.bannerHtml);
  if (input.bannerBg !== undefined) patch.banner_bg = normalizeBannerBg(input.bannerBg);
  if (input.showCountdown !== undefined) patch.show_countdown = input.showCountdown;
  if (input.organizerName !== undefined) patch.organizer_name = input.organizerName;
  if (input.organizerPhone !== undefined) patch.organizer_phone = input.organizerPhone;
  if (input.organizerEmail !== undefined) patch.organizer_email = input.organizerEmail;

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
