// Event Email — audience segment resolver (build spec §4/§9). Registrant counts
// are computed server-side against the events registration table; only counts are
// returned to the client (raw lists never leave the server).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type RegistrantStatus = "registered" | "attended" | "no_show";
export type RegistrantCounts = { registered: number; attended: number; no_show: number; total: number };

async function countBy(supabase: SupabaseClient<Database>, eventId: string, status?: RegistrantStatus): Promise<number> {
  let q = raw(supabase).from("registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  if (status) q = q.eq("status", status);
  const { count } = await q;
  return count ?? 0;
}

/** Registrant counts for an event, broken down by status. Counts only. */
export async function resolveRegistrantCounts(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<RegistrantCounts> {
  const [registered, attended, no_show, total] = await Promise.all([
    countBy(supabase, eventId, "registered"),
    countBy(supabase, eventId, "attended"),
    countBy(supabase, eventId, "no_show"),
    countBy(supabase, eventId),
  ]);
  return { registered, attended, no_show, total };
}
