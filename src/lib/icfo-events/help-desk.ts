import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type HelpRequest = {
  id: string;
  message: string;
  requesterName: string;
  createdAt: string;
};

/** File a help request (attendee, via their RLS-scoped client). */
export async function createHelpRequest(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
  message: string,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_help_requests")
    .insert({ event_id: eventId, profile_id: profileId, message: message.slice(0, 500) });
  if (error) throw new Error(error.message);
}

type HelpRow = {
  id: string;
  message: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

/** Open requests for an event (staff/service-role client). */
export async function listOpenHelpRequests(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<HelpRequest[]> {
  const { data, error } = await raw(supabase)
    .from("event_help_requests")
    .select("id, message, created_at, profiles:profile_id(full_name, email)")
    .eq("event_id", eventId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return ((data ?? []) as unknown as HelpRow[]).map((r) => ({
    id: r.id,
    message: r.message,
    createdAt: r.created_at,
    requesterName: r.profiles?.full_name ?? r.profiles?.email ?? "Attendee",
  }));
}

export async function resolveHelpRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  actorId: string,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_help_requests")
    .update({ status: "resolved", resolved_by: actorId, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}
