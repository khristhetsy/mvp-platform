// Opt-in networking. Default off. Suggestions only in Phase 1 (no connection
// handshake — that's Phase 3). Suggestions are other opted-in attendees,
// weighted by shared sector interests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { NetworkingOptin } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapOptin(r: Row): NetworkingOptin {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    profileId: String(r.profile_id),
    optedIn: Boolean(r.opted_in),
    interests: Array.isArray(r.interests) ? (r.interests as string[]) : [],
  };
}

export async function getOptin(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
): Promise<NetworkingOptin | null> {
  const { data } = await raw(supabase)
    .from("networking_optins")
    .select("*")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return data ? mapOptin(data as Row) : null;
}

export async function upsertOptin(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
  optedIn: boolean,
  interests: string[],
): Promise<NetworkingOptin> {
  const { data, error } = await raw(supabase)
    .from("networking_optins")
    .upsert(
      { event_id: eventId, profile_id: profileId, opted_in: optedIn, interests },
      { onConflict: "event_id,profile_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapOptin(data as Row);
}

export interface NetworkingSuggestion {
  profileId: string;
  displayName: string;
  sharedInterests: string[];
  score: number;
}

/**
 * Sector-weighted suggestions for an opted-in member: other opted-in attendees
 * at the same event, ranked by count of shared interests. Names only — no emails
 * or raw contact data (the opt-in trust model). Returns [] if the caller hasn't
 * opted in.
 */
export async function listSuggestions(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
  limit = 10,
): Promise<NetworkingSuggestion[]> {
  const me = await getOptin(supabase, eventId, profileId);
  if (!me || !me.optedIn) return [];

  const { data } = await raw(supabase)
    .from("networking_optins")
    .select("profile_id, interests, profiles:profile_id(full_name)")
    .eq("event_id", eventId)
    .eq("opted_in", true)
    .neq("profile_id", profileId);

  const mine = new Set(me.interests);
  const rows = (data ?? []) as Row[];
  return rows
    .map((r) => {
      const interests = Array.isArray(r.interests) ? (r.interests as string[]) : [];
      const shared = interests.filter((i) => mine.has(i));
      const profile = r.profiles as { full_name?: string | null } | null;
      return {
        profileId: String(r.profile_id),
        displayName: profile?.full_name ?? "Attendee",
        sharedInterests: shared,
        score: shared.length,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
