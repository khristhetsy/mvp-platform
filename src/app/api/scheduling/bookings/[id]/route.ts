/**
 * Update a booking's status (staff-only). Confirmed → Completed / No-show / Cancelled.
 * Cancelling also removes the host's calendar event (and its Google copy) and emails
 * both parties. Calendar + email + activity are best-effort — a hiccup there never
 * blocks the status change.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getBooking, updateBookingStatus, BOOKING_STATUSES } from "@/lib/scheduling/bookings";
import { cancelEvent } from "@/lib/calendar/events";
import { sendBookingCancellation } from "@/lib/scheduling/notify";
import { logActivity } from "@/lib/sales/activity";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(BOOKING_STATUSES) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const { status } = parsed.data;

  const before = await getBooking(id);
  if (!before) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const updated = await updateBookingStatus(id, status);
  if (!updated) return NextResponse.json({ error: "Couldn’t update the booking." }, { status: 500 });

  if (status === "cancelled") {
    // Remove the host's calendar event (+ Google copy), notify both parties.
    if (before.host_id && before.event_id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await cancelEvent(createServiceRoleClient() as any, before.host_id, before.event_id);
      } catch { /* best-effort */ }
    }
    try {
      await sendBookingCancellation({
        hostEmail: before.host_email ?? null, hostName: before.host_name ?? null,
        bookerEmail: before.booker_email, bookerName: before.booker_name,
        title: before.event_type ?? "Meeting", startTime: before.start_time, timezone: before.timezone ?? "UTC",
      });
    } catch { /* best-effort */ }
  }

  // Log the status change on the linked contact's timeline (best-effort).
  if (before.contact_crm_id) {
    const verb = status === "cancelled" ? "Booking cancelled" : status === "completed" ? "Booking completed" : status === "no_show" ? "Booking marked no-show" : "Booking reconfirmed";
    await logActivity({ kind: "note", summary: `${verb}${before.event_type ? `: ${before.event_type}` : ""}`, actorId: profile.id, contactCrmId: before.contact_crm_id });
  }

  return NextResponse.json({ ok: true, booking: updated });
}
