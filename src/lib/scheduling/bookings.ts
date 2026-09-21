/**
 * Structured bookings store — the rich record behind the iCapOS scheduler (invitee,
 * event type, slot, Meet link, intake Q&A). Written on every successful bookSlot and
 * read by the Bookings page + contact detail. Service-role only.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SourceConfidence } from "@/lib/attribution/source";

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
  booker_company: string | null;
  contact_crm_id: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  meet_url: string | null;
  note: string | null;
  answers: BookingAnswer[];
  /** Campaign this meeting is attributed to. Null = unattributed, shown as such. */
  source_tag: string | null;
  /** How the tag was obtained — the funnel reports tagged and self-reported separately. */
  source_confidence: SourceConfidence | null;
  /** Only set when a staff member overrode the automatic answer. */
  source_set_by: string | null;
  source_set_at: string | null;
  status: string;
  created_at: string;
};

/**
 * Attribution is optional on create: the IR meeting flow and a reschedule have
 * no campaign to record, and forcing them to pass four nulls would be noise.
 * Omitted means unattributed, which is a real and honest state.
 */
export type CreateBookingInput = Omit<
  Booking,
  "id" | "created_at" | "status" | "host_name" | "source_tag" | "source_confidence" | "source_set_by" | "source_set_at"
> & {
  status?: string;
  source_tag?: string | null;
  source_confidence?: SourceConfidence | null;
  source_set_by?: string | null;
  source_set_at?: string | null;
};

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
    booker_company: input.booker_company ?? null,
    contact_crm_id: input.contact_crm_id,
    start_time: input.start_time,
    end_time: input.end_time,
    timezone: input.timezone,
    meet_url: input.meet_url,
    note: input.note,
    answers: input.answers ?? [],
    source_tag: input.source_tag ?? null,
    source_confidence: input.source_confidence ?? null,
    source_set_by: input.source_set_by ?? null,
    source_set_at: input.source_set_at ?? null,
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
    booker_company: (r.booker_company as string) ?? null,
    contact_crm_id: (r.contact_crm_id as string) ?? null,
    start_time: String(r.start_time), end_time: String(r.end_time), timezone: (r.timezone as string) ?? null,
    meet_url: (r.meet_url as string) ?? null, note: (r.note as string) ?? null,
    answers: Array.isArray(r.answers) ? (r.answers as BookingAnswer[]) : [],
    source_tag: (r.source_tag as string) ?? null,
    source_confidence: (r.source_confidence as SourceConfidence) ?? null,
    source_set_by: (r.source_set_by as string) ?? null,
    source_set_at: (r.source_set_at as string) ?? null,
    status: String(r.status ?? "confirmed"), created_at: String(r.created_at),
  };
}

const SELECT = "id, host_id, event_id, event_type, booker_name, booker_email, booker_phone, booker_company, contact_crm_id, start_time, end_time, timezone, meet_url, note, answers, source_tag, source_confidence, source_set_by, source_set_at, status, created_at, host:profiles!scheduling_bookings_host_id_fkey(full_name, email)";

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

/**
 * Staff override — the only signal that beats a machine-captured one.
 *
 * Recorded with who and when, because "a human decided this" is different
 * evidence from "a cookie said so" and the funnel reports them separately.
 * Passing a null tag clears the attribution back to unattributed.
 */
export async function setBookingSource(input: {
  bookingId: string;
  tag: string | null;
  userId: string;
}): Promise<{ error?: string }> {
  const { error } = await db()
    .from("scheduling_bookings")
    .update(
      input.tag
        ? {
            source_tag: input.tag,
            source_confidence: "manual",
            source_set_by: input.userId,
            source_set_at: new Date().toISOString(),
          }
        : {
            // The pair constraint means both go, or neither.
            source_tag: null,
            source_confidence: null,
            source_set_by: input.userId,
            source_set_at: new Date().toISOString(),
          },
    )
    .eq("id", input.bookingId);
  return { error: error?.message };
}
