/**
 * Signed, single-purpose action tokens for the public booking-management links
 * (Cancel / Reschedule) that ride in confirmation emails. No login: possession of
 * the emailed link is the authorization, so tokens are HMAC-signed (the secret is
 * never in the payload), scoped to one booking id, bound to a single action, and
 * expire. Server-only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type BookingAction = "cancel" | "reschedule";

function secret(): string {
  return process.env.TOKEN_ENCRYPTION_SECRET || process.env.MARKETING_UNSUBSCRIBE_SECRET || "default-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** `base64url({id,action,exp}).sig`. exp is a unix-ms expiry (default: 60 days). */
export function makeBookingToken(bookingId: string, action: BookingAction, expiresAt?: number): string {
  const exp = expiresAt ?? Date.now() + 60 * 24 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ id: bookingId, a: action, exp })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the booking id when the token is valid for `action` and unexpired, else null. */
export function verifyBookingToken(token: string, action: BookingAction, now: number = Date.now()): string | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = sign(body);
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { id?: string; a?: string; exp?: number };
    if (!parsed.id || parsed.a !== action) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return parsed.id;
  } catch {
    return null;
  }
}
