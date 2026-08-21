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

// Staff-facing registration row (all attendee types) with contact details.
// Editable contact fields are stored as overrides in `answers` so the
// registrant's user profile is never modified; they fall back to the profile.
export interface EventRegistrationRow {
  id: string;
  eventId: string;
  attendeeType: string | null;
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  answers: Record<string, unknown>;
  createdAt: string;
}

function mapReg(r: Record<string, unknown>): EventRegistrationRow {
  const profile = r.profiles as { full_name?: string | null; email?: string | null } | null;
  const answers = (r.answers as Record<string, unknown>) ?? {};
  const ov = (k: string) => (typeof answers[k] === "string" && answers[k] ? (answers[k] as string) : null);
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    attendeeType: (r.attendee_type as string | null) ?? null,
    company: ov("company"),
    contactName: ov("name") ?? profile?.full_name ?? null,
    contactEmail: ov("email") ?? profile?.email ?? null,
    contactPhone: ov("phone"),
    answers,
    createdAt: String(r.created_at),
  };
}

/** All registrations for an event, newest first (staff only). */
export async function listEventRegistrations(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventRegistrationRow[]> {
  const { data, error } = await raw(supabase)
    .from("registrations")
    .select("*, profiles:attendee_id(full_name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapReg);
}

/** Edit a registrant's contact details (stored as overrides in answers). */
export async function setRegistrationContact(
  supabase: SupabaseClient<Database>,
  registrationId: string,
  patch: { contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; company?: string | null },
): Promise<EventRegistrationRow> {
  const { data: cur, error: readErr } = await raw(supabase)
    .from("registrations")
    .select("answers")
    .eq("id", registrationId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const answers = { ...(((cur as Record<string, unknown>)?.answers as Record<string, unknown>) ?? {}) };
  if (patch.contactName !== undefined) answers.name = patch.contactName ?? "";
  if (patch.contactEmail !== undefined) answers.email = patch.contactEmail ?? "";
  if (patch.contactPhone !== undefined) answers.phone = patch.contactPhone ?? "";
  if (patch.company !== undefined) answers.company = patch.company ?? "";
  const { data, error } = await raw(supabase)
    .from("registrations")
    .update({ answers })
    .eq("id", registrationId)
    .select("*, profiles:attendee_id(full_name, email)")
    .single();
  if (error) throw new Error(error.message);
  return mapReg(data as Record<string, unknown>);
}

/** Manually register a guest (staff). Links to an existing user if their email
 *  matches a profile; otherwise registers as an account-less guest. */
export async function createManualRegistration(
  supabase: SupabaseClient<Database>,
  eventId: string,
  input: { attendeeType: string; answers: Record<string, unknown> },
): Promise<EventRegistrationRow> {
  const db = raw(supabase);
  const email = typeof input.answers.email === "string" ? (input.answers.email as string).trim() : "";
  let attendeeId: string | null = null;
  if (email) {
    const { data: prof } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
    attendeeId = ((prof as { id?: string } | null)?.id) ?? null;
  }
  const row = { event_id: eventId, attendee_type: input.attendeeType, answers: input.answers };
  const { data, error } = attendeeId
    ? await db
        .from("registrations")
        .upsert({ ...row, attendee_id: attendeeId }, { onConflict: "event_id,attendee_id" })
        .select("*, profiles:attendee_id(full_name, email)")
        .single()
    : await db
        .from("registrations")
        .insert({ ...row, attendee_id: null })
        .select("*, profiles:attendee_id(full_name, email)")
        .single();
  if (error) throw new Error(error.message);
  return mapReg(data as Record<string, unknown>);
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
