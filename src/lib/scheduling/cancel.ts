/**
 * Cancel a booking: flip status, remove the host calendar event (+ Google copy),
 * optionally notify both parties, and log it to the contact timeline. Shared by the
 * staff action, the public token cancel link, and the reschedule flow (silent).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBooking, updateBookingStatus, type Booking } from "./bookings";
import { cancelEvent } from "@/lib/calendar/events";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendBookingCancellation } from "./notify";
import { logActivity } from "@/lib/sales/activity";
import { verifyBookingToken, type BookingAction } from "./tokens";

export async function cancelBookingById(bookingId: string, opts: { notify?: boolean } = {}): Promise<Booking | null> {
  const before = await getBooking(bookingId);
  if (!before) return null;
  if (before.status === "cancelled") return before;

  const updated = await updateBookingStatus(bookingId, "cancelled");

  if (before.host_id && before.event_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await cancelEvent(createServiceRoleClient() as unknown as SupabaseClient<any>, before.host_id, before.event_id);
    } catch { /* best-effort */ }
  }
  if (opts.notify) {
    try {
      await sendBookingCancellation({
        hostEmail: before.host_email ?? null, hostName: before.host_name ?? null,
        bookerEmail: before.booker_email, bookerName: before.booker_name,
        title: before.event_type ?? "Meeting", startTime: before.start_time, timezone: before.timezone ?? "UTC",
      });
    } catch { /* best-effort */ }
  }
  if (before.contact_crm_id) {
    await logActivity({ kind: "note", summary: `Booking cancelled${before.event_type ? `: ${before.event_type}` : ""}`, contactCrmId: before.contact_crm_id }).catch(() => {});
  }
  return updated ?? before;
}

/** Verify a signed link token then cancel. `silent` skips the cancellation email
 *  (used by reschedule, where the new-booking confirmation already went out). */
export async function cancelBookingByToken(token: string, action: BookingAction, opts: { silent?: boolean } = {}): Promise<{ ok: boolean; booking: Booking | null }> {
  const id = verifyBookingToken(token, action);
  if (!id) return { ok: false, booking: null };
  const booking = await cancelBookingById(id, { notify: !opts.silent });
  return { ok: Boolean(booking), booking };
}
