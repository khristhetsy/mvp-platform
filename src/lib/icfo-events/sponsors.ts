// Sponsors catalog + per-event placement. Logos live in the private
// event-sponsor-logos bucket; render via short-lived signed URLs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SponsorInput } from "./schemas";
import type { EventSponsor, Sponsor } from "./types";

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

export async function listSponsors(supabase: SupabaseClient<Database>): Promise<Sponsor[]> {
  const { data, error } = await raw(supabase).from("sponsors").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSponsor);
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
