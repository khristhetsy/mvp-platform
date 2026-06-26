// Networking Lounge: topic tables + ambient chat. Server-side loaders for the
// initial render; live updates happen client-side via Supabase Realtime.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export interface LoungeTable {
  id: string;
  eventId: string;
  title: string;
  topic: string | null;
  sectorSlug: string | null;
  createdBy: string | null;
}

export interface LoungeMessage {
  id: string;
  tableId: string;
  profileId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export function mapLoungeTable(r: Row): LoungeTable {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    title: String(r.title),
    topic: (r.topic as string | null) ?? null,
    sectorSlug: (r.sector_slug as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
  };
}

export function mapLoungeMessage(r: Row): LoungeMessage {
  const profile = r.profiles as { full_name?: string | null } | null | undefined;
  return {
    id: String(r.id),
    tableId: String(r.table_id),
    profileId: String(r.profile_id),
    authorName: profile?.full_name ?? "Attendee",
    body: String(r.body),
    createdAt: String(r.created_at),
  };
}

export async function loadLoungeTables(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<LoungeTable[]> {
  const { data, error } = await raw(supabase)
    .from("lounge_tables")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLoungeTable);
}

export async function loadRecentMessages(
  supabase: SupabaseClient<Database>,
  tableId: string,
  limit = 50,
): Promise<LoungeMessage[]> {
  const { data, error } = await raw(supabase)
    .from("lounge_messages")
    .select("*, profiles:profile_id(full_name)")
    .eq("table_id", tableId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLoungeMessage).reverse();
}
