// Sponsors catalog + per-event placement. Logos live in the private
// event-sponsor-logos bucket; render via short-lived signed URLs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SponsorInput } from "./schemas";
import type { EventSponsor, Sponsor, SponsorLead } from "./types";

export const SPONSOR_LOGO_BUCKET = "event-sponsor-logos";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapSponsor(r: Row): Sponsor {
  return {
    id: String(r.id),
    name: String(r.name),
    logoPath: (r.logo_path as string | null) ?? null,
    blurb: (r.blurb as string | null) ?? null,
    website: (r.website as string | null) ?? null,
    tier: r.tier as Sponsor["tier"],
    sectorSlug: (r.sector_slug as string | null) ?? null,
    category: r.category as Sponsor["category"],
    categoryExclusive: Boolean(r.category_exclusive),
    ownerId: (r.owner_id as string | null) ?? null,
    downloads: Array.isArray(r.downloads) ? (r.downloads as Sponsor["downloads"]) : [],
  };
}

export async function createSponsor(
  supabase: SupabaseClient<Database>,
  input: SponsorInput,
): Promise<Sponsor> {
  const { data, error } = await raw(supabase)
    .from("sponsors")
    .insert({
      name: input.name,
      blurb: input.blurb ?? null,
      website: input.website ?? null,
      logo_path: input.logoPath ?? null,
      tier: input.tier,
      category: input.category,
      sector_slug: input.sectorSlug ?? null,
      category_exclusive: input.categoryExclusive,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSponsor(data as Row);
}

export async function getSponsorById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Sponsor | null> {
  const { data } = await raw(supabase).from("sponsors").select("*").eq("id", id).maybeSingle();
  return data ? mapSponsor(data as Row) : null;
}

export async function listSponsors(supabase: SupabaseClient<Database>): Promise<Sponsor[]> {
  const { data, error } = await raw(supabase).from("sponsors").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSponsor);
}

/** Object path for a sponsor logo: <sponsorId>/<timestamp>-<sanitized name>. */
export function buildSponsorLogoPath(sponsorId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${sponsorId}/${Date.now()}-${safe}`;
}

export async function uploadSponsorLogo(
  supabase: SupabaseClient<Database>,
  path: string,
  bytes: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await raw(supabase).storage
    .from(SPONSOR_LOGO_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Logo upload failed: ${error.message}`);
}

export async function setSponsorLogoPath(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
  logoPath: string,
): Promise<Sponsor> {
  const { data, error } = await raw(supabase)
    .from("sponsors")
    .update({ logo_path: logoPath })
    .eq("id", sponsorId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSponsor(data as Row);
}

/** Signed logo URL for a single sponsor (admin preview). */
export async function sponsorLogoSignedUrl(path: string | null): Promise<string | null> {
  return signedLogoUrl(path);
}

export async function linkSponsorToEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  sponsorId: string,
  placement: EventSponsor["placement"],
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_sponsors")
    .upsert({ event_id: eventId, sponsor_id: sponsorId, placement }, { onConflict: "event_id,sponsor_id" });
  if (error) throw new Error(error.message);
}

export async function unlinkSponsorFromEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  sponsorId: string,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_sponsors")
    .delete()
    .eq("event_id", eventId)
    .eq("sponsor_id", sponsorId);
  if (error) throw new Error(error.message);
}

/** Signed logo URL (private bucket). Best-effort — returns null on failure. */
async function signedLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.storage.from(SPONSOR_LOGO_BUCKET).createSignedUrl(path, 3600);
    return error ? null : data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export interface SponsorBoothEvent {
  eventId: string;
  title: string;
  slug: string;
  placement: EventSponsor["placement"];
  status: string;
}

export interface SponsorHostedSession {
  sessionId: string;
  title: string;
  eventSlug: string;
  eventTitle: string;
}

export interface SponsorBooth extends Sponsor {
  logoUrl: string | null;
  events: SponsorBoothEvent[];
  hostedSessions: SponsorHostedSession[];
}

/** Public booth: a sponsor profile + the published events they partner. */
export async function getSponsorBooth(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
): Promise<SponsorBooth | null> {
  const { data, error } = await raw(supabase).from("sponsors").select("*").eq("id", sponsorId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const sponsor = mapSponsor(data as Row);

  const { data: links } = await raw(supabase)
    .from("event_sponsors")
    .select("placement, events:event_id(id, title, slug, status)")
    .eq("sponsor_id", sponsorId);

  const events: SponsorBoothEvent[] = ((links ?? []) as Row[])
    .map((row) => {
      const e = row.events as Row | null;
      if (!e) return null;
      const status = String(e.status);
      if (!["published", "live", "ended"].includes(status)) return null;
      return {
        eventId: String(e.id),
        title: String(e.title),
        slug: String(e.slug),
        placement: row.placement as EventSponsor["placement"],
        status,
      };
    })
    .filter((x): x is SponsorBoothEvent => x !== null);

  const { data: hosted } = await raw(supabase)
    .from("sessions")
    .select("id, title, events:event_id(slug, title, status)")
    .eq("host_sponsor_id", sponsorId);

  const hostedSessions: SponsorHostedSession[] = ((hosted ?? []) as Row[])
    .map((row) => {
      const e = row.events as Row | null;
      if (!e || !["published", "live", "ended"].includes(String(e.status))) return null;
      return {
        sessionId: String(row.id),
        title: String(row.title),
        eventSlug: String(e.slug),
        eventTitle: String(e.title),
      };
    })
    .filter((x): x is SponsorHostedSession => x !== null);

  return { ...sponsor, logoUrl: await signedLogoUrl(sponsor.logoPath), events, hostedSessions };
}

// ── sponsor self-service (owner) ──────────────────────────────────────────────

/** Admin: link/unlink a sponsor to a managing user. */
export async function setSponsorOwner(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
  ownerId: string | null,
): Promise<void> {
  const { error } = await raw(supabase).from("sponsors").update({ owner_id: ownerId }).eq("id", sponsorId);
  if (error) throw new Error(error.message);
}

/** Sponsors managed by a given user. */
export async function listSponsorsByOwner(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<Sponsor[]> {
  const { data, error } = await raw(supabase).from("sponsors").select("*").eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSponsor);
}

/** A sponsor if (and only if) the given user owns it. */
export async function getOwnedSponsor(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
  ownerId: string,
): Promise<Sponsor | null> {
  const { data } = await raw(supabase)
    .from("sponsors")
    .select("*")
    .eq("id", sponsorId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data ? mapSponsor(data as Row) : null;
}

/** Owner-editable booth fields. RLS enforces ownership. */
export async function updateSponsorBooth(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
  fields: { blurb?: string | null; website?: string | null; downloads?: { label: string; url: string }[] },
): Promise<Sponsor> {
  const patch: Record<string, unknown> = {};
  if (fields.blurb !== undefined) patch.blurb = fields.blurb;
  if (fields.website !== undefined) patch.website = fields.website;
  if (fields.downloads !== undefined) patch.downloads = fields.downloads;
  const { data, error } = await raw(supabase)
    .from("sponsors")
    .update(patch)
    .eq("id", sponsorId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSponsor(data as Row);
}

/** Opt-in leads for a sponsor (visible to its owner + staff via RLS). */
export async function listSponsorLeads(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
): Promise<SponsorLead[]> {
  const { data, error } = await raw(supabase)
    .from("sponsor_leads")
    .select("*, profiles:profile_id(full_name,email), events:event_id(title)")
    .eq("sponsor_id", sponsorId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => {
    const p = r.profiles as { full_name?: string | null; email?: string | null } | null;
    const e = r.events as { title?: string | null } | null;
    return {
      id: String(r.id),
      sponsorId: String(r.sponsor_id),
      profileId: String(r.profile_id),
      attendeeName: p?.full_name ?? p?.email ?? null,
      eventId: (r.event_id as string | null) ?? null,
      eventTitle: e?.title ?? null,
      message: (r.message as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  });
}

/** Find a profile id by email (admin owner assignment). */
export async function findProfileIdByEmail(
  supabase: SupabaseClient<Database>,
  email: string,
): Promise<string | null> {
  const { data } = await raw(supabase)
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  return data ? String((data as Row).id) : null;
}

/** Record an opt-in intro request (attendee chose to connect with the sponsor). */
export async function createSponsorLead(
  supabase: SupabaseClient<Database>,
  sponsorId: string,
  profileId: string,
  eventId: string | null,
  message: string | null,
): Promise<{ id: string }> {
  const { data, error } = await raw(supabase)
    .from("sponsor_leads")
    .insert({ sponsor_id: sponsorId, profile_id: profileId, event_id: eventId, message })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as Row).id) };
}

/** Sponsors attached to an event, joined with placement + a signed logo URL. */
export async function listEventSponsors(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventSponsor[]> {
  const { data, error } = await raw(supabase)
    .from("event_sponsors")
    .select("id, placement, sponsors:sponsor_id(*)")
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  const out: EventSponsor[] = [];
  for (const row of rows) {
    const sponsorRow = row.sponsors as Row | null;
    if (!sponsorRow) continue;
    const sponsor = mapSponsor(sponsorRow);
    out.push({
      ...sponsor,
      eventSponsorId: String(row.id),
      placement: row.placement as EventSponsor["placement"],
      logoUrl: await signedLogoUrl(sponsor.logoPath),
    });
  }
  return out;
}
