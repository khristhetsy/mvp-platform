/**
 * Booking cancel/reschedule links.
 *
 * The signing itself now lives in `@/lib/signed-links/tokens` so event
 * invitations share one implementation; this module keeps the booking-shaped
 * API its four callers already use, and pins the token kind.
 */
import { makeToken, verifyToken } from "@/lib/signed-links/tokens";

export type BookingAction = "cancel" | "reschedule";

/** `base64url({k,id,a,n,exp}).sig`. exp is a unix-ms expiry (default: 60 days). */
export function makeBookingToken(bookingId: string, action: BookingAction, expiresAt?: number): string {
  return makeToken({ kind: "booking", id: bookingId, action, expiresAt });
}

/** Returns the booking id when the token is valid for `action` and unexpired, else null. */
export function verifyBookingToken(token: string, action: BookingAction, now: number = Date.now()): string | null {
  return verifyToken({ token, kind: "booking", action, now });
}
