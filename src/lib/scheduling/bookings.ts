/**
 * Structured bookings store — the rich record behind the iCapOS scheduler (invitee,
 * event type, slot, Meet link, intake Q&A). Written on every successful bookSlot and
 * read by the Bookings page + contact detail. Service-role only.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type BookingAnswer = { label: string; value: string };

export type Booking = {
  id: string;
  host_id: string | null;
  host_name?: string | null;
  host_email?: string | null;
  event_id: string | null;
  event_type: string | null;
  booker_name: string | null;
  booker_email: string | null;
  booker_phone: string | null;
  contact_crm_id: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  meet_url: string | null;
  note: string | null;
  answers: BookingAnswer[];
  status: string;
  created_at: string;
};

export type CreateBookingInput = Omit<Booking, "id" | "created_at" | "status" | "host_name"> & { status?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export async function createBooking(input: CreateBookingInput): Promise<string | null> {
  const { data, error } = await db().from("scheduling_bookings").insert({
    host_id: input.host_id,
    event_id: input.event_id,
    event_type: input.event_type,
    booker_name: input.booker_name,
    booker_email: input.booker_email,
    booker_phone: input.booker_phone,
    contact_crm_id: input.contact_crm_id,
    start_time: input.start_time,
    end_time: input.end_time,
    timezone: input.timezone,
    meet_url: input.meet_url,
    note: input.note,
    answers: input.answers ?? [],
    status: input.status ?? "confirmed",
  }).select("id").single();
  if (error) return null;
  return (data?.id as string) ?? null;
}

function mapRow(r: Record<string, unknown>): Booking {
  const host = r.host as { full_name?: string | null; email?: string | null } | null;
  return {
    id: String(r.id), host_id: (r.host_id as string) ?? null, host_name: host?.full_name ?? host?.email ?? null, host_email: host?.email ?? null,
    event_id: (r.event_id as string) ?? null, event_type: (r.event_type as string) ?? null,
    booker_name: (r.booker_name as string) ?? null, booker_email: (r.booker_email as string) ?? null, booker_phone: (r.booker_phone as string) ?? null,
    contact_crm_id: (r.contact_crm_id as string) ?? null,
    start_time: String(r.start_time), end_time: String(r.end_time), timezone: (r.timezone as string) ?? null,
    meet_url: (r.meet_url as string) ?? null, note: (r.note as string) ?? null,
    answers: Array.isArray(r.answers) ? (r.answers as BookingAnswer[]) : [],
    status: String(r.status ?? "confirmed"), created_at: String(r.created_at),
  };
}

const SELECT = "id, host_id, event_id, event_type, booker_name, booker_email, booker_phone, contact_crm_id, start_time, end_time, timezone, meet_url, note, answers, status, created_at, host:profiles!scheduling_bookings_host_id_fkey(full_name, email)";

export async function listBookings(opts: { hostId?: string; limit?: number } = {}): Promise<Booking[]> {
  let q = db().from("scheduling_bookings").select(SELECT).order("start_time", { ascending: false }).limit(opts.limit ?? 200);
  if (opts.hostId) q = q.eq("host_id", opts.hostId);
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const { data } = await db().from("scheduling_bookings").select(SELECT).eq("id", id).maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export const BOOKING_STATUSES = ["confirmed", "completed", "cancelled", "no_show"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Set a booking's status; returns the updated row (with host) or null on failure. */
export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking | null> {
  const { data, error } = await db().from("scheduling_bookings").update({ status }).eq("id", id).select(SELECT).maybeSingle();
  if (error) return null;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** Set a booking's internal note (Calendly-style private meeting notes). */
export async function updateBookingNote(id: string, note: string | null): Promise<Booking | null> {
  const { data, error } = await db().from("scheduling_bookings").update({ note }).eq("id", id).select(SELECT).maybeSingle();
  if (error) return null;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function listContactBookings(contactCrmId: string): Promise<Booking[]> {
  const { data } = await db().from("scheduling_bookings").select(SELECT).eq("contact_crm_id", contactCrmId).order("start_time", { ascending: false }).limit(50);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}
