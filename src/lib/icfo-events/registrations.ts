// Event registrations. Attendance signal only — never exported raw to sponsors.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { RegistrationStatus } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  status: RegistrationStatus;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): Registration {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    attendeeId: String(r.attendee_id),
    status: r.status as RegistrationStatus,
    createdAt: String(r.created_at),
  };
}

/** Idempotent register — returns the existing row if already registered. */
export async function registerForEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  attendeeId: string,
): Promise<{ registration: Registration; created: boolean }> {
  const existing = await raw(supabase)
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .maybeSingle();
  if (existing.data) return { registration: mapRow(existing.data as Record<string, unknown>), created: false };

  const { data, error } = await raw(supabase)
    .from("registrations")
    .insert({ event_id: eventId, attendee_id: attendeeId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { registration: mapRow(data as Record<string, unknown>), created: true };
}

export async function getRegistration(
  supabase: SupabaseClient<Database>,
  eventId: string,
  attendeeId: string,
): Promise<Registration | null> {
  const { data } = await raw(supabase)
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** Aggregate count only (the opt-in trust model forbids raw lists). */
export async function countRegistrations(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<number> {
  const { count } = await raw(supabase)
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
