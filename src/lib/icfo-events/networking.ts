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
function isComplementary(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return (x === "founder" && y === "investor") || (x === "investor" && y === "founder");
}

export async function listSuggestions(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
  limit = 10,
): Promise<NetworkingSuggestion[]> {
  const me = await getOptin(supabase, eventId, profileId);
  if (!me || !me.optedIn) return [];

  // The viewer's own role, for complementarity weighting (founder ↔ investor).
  const { data: meProfile } = await raw(supabase).from("profiles").select("role").eq("id", profileId).maybeSingle();
  const myRole = String((meProfile as { role?: string | null } | null)?.role ?? "");

  const { data } = await raw(supabase)
    .from("networking_optins")
    .select("profile_id, interests, profiles:profile_id(full_name, role)")
    .eq("event_id", eventId)
    .eq("opted_in", true)
    .neq("profile_id", profileId);

  const mine = new Set(me.interests);
  const rows = (data ?? []) as Row[];
  return rows
    .map((r) => {
      const interests = Array.isArray(r.interests) ? (r.interests as string[]) : [];
      const shared = interests.filter((i) => mine.has(i));
      const profile = r.profiles as { full_name?: string | null; role?: string | null } | null;
      // Sector overlap is weighted ×2; a complementary founder↔investor pairing
      // adds a fixed bonus so the right people surface even without shared sectors.
      const complementaryBonus = profile?.role && isComplementary(myRole, profile.role) ? 3 : 0;
      return {
        profileId: String(r.profile_id),
        displayName: profile?.full_name ?? "Attendee",
        sharedInterests: shared,
        score: shared.length * 2 + complementaryBonus,
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── connection handshake (Phase 3) ────────────────────────────────────────────

export type NetworkingConnectionStatus = "requested" | "accepted" | "declined";

export interface NetworkingConnection {
  id: string;
  eventId: string;
  fromId: string;
  toId: string;
  status: NetworkingConnectionStatus;
  direction: "outgoing" | "incoming";
  otherName: string;
  otherProfileId: string;
}

export async function createConnectionRequest(
  supabase: SupabaseClient<Database>,
  eventId: string,
  fromId: string,
  toId: string,
): Promise<{ id: string }> {
  const { data, error } = await raw(supabase)
    .from("networking_connections")
    .insert({ event_id: eventId, from_id: fromId, to_id: toId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as Row).id) };
}

export async function respondToConnection(
  supabase: SupabaseClient<Database>,
  connectionId: string,
  responderId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("networking_connections")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("to_id", responderId);
  if (error) throw new Error(error.message);
}

/** All connections touching this member at an event, annotated with direction + other party. */
export async function listConnections(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
): Promise<NetworkingConnection[]> {
  const { data } = await raw(supabase)
    .from("networking_connections")
    .select("*, fromp:from_id(full_name), top:to_id(full_name)")
    .eq("event_id", eventId)
    .or(`from_id.eq.${profileId},to_id.eq.${profileId}`);

  const rows = (data ?? []) as Row[];
  return rows.map((r) => {
    const outgoing = String(r.from_id) === profileId;
    const fromp = r.fromp as { full_name?: string | null } | null;
    const top = r.top as { full_name?: string | null } | null;
    return {
      id: String(r.id),
      eventId: String(r.event_id),
      fromId: String(r.from_id),
      toId: String(r.to_id),
      status: r.status as NetworkingConnectionStatus,
      direction: outgoing ? "outgoing" : "incoming",
      otherName: (outgoing ? top?.full_name : fromp?.full_name) ?? "Attendee",
      otherProfileId: outgoing ? String(r.to_id) : String(r.from_id),
    };
  });
}
