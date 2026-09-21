/**
 * Signed, single-purpose action links for people who are not signed in.
 *
 * Possession of the emailed link is the authorization, so a token is
 * HMAC-signed (the secret never travels in the payload), scoped to one subject
 * id, bound to one kind and one action, and expires. Server-only.
 *
 * Generalised out of the booking cancel/reschedule links so event invitations
 * share one implementation — two copies of link signing is how one of them ends
 * up without an expiry check.
 *
 * `nonce` is what makes a link revocable: mix in a value stored on the row
 * (e.g. `event_presenter_invites.token_nonce`) and rotating that value kills
 * every outstanding link for that row without deleting its history.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** The subject a token points at. Add a kind here, not a new token module. */
export type TokenKind = "booking" | "event_invite";

export type TokenInput = {
  kind: TokenKind;
  id: string;
  action: string;
  /** Optional per-row secret; rotating it revokes outstanding links. */
  nonce?: string | null;
  /** Unix ms. Defaults to 60 days. */
  expiresAt?: number;
};

const DEFAULT_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.TOKEN_ENCRYPTION_SECRET || process.env.MARKETING_UNSUBSCRIBE_SECRET || "default-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** `base64url({k,id,a,n,exp}).sig` */
export function makeToken({ kind, id, action, nonce, expiresAt }: TokenInput): string {
  const exp = expiresAt ?? Date.now() + DEFAULT_TTL_MS;
  const body = Buffer.from(
    JSON.stringify({ k: kind, id, a: action, n: nonce ?? null, exp }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export type VerifyInput = {
  token: string;
  kind: TokenKind;
  action: string;
  /** Must equal the nonce the token was signed with, when one was used. */
  nonce?: string | null;
  now?: number;
};

/**
 * The subject id when the token is valid for this kind + action + nonce and has
 * not expired, else null. Never throws — a malformed token is just invalid.
 */
export function verifyToken({ token, kind, action, nonce, now = Date.now() }: VerifyInput): string | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = sign(body);
    // Compare lengths first: timingSafeEqual throws on a length mismatch.
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      k?: string; id?: string; a?: string; n?: string | null; exp?: number;
    };
    if (!parsed.id || parsed.k !== kind || parsed.a !== action) return null;
    // A rotated nonce invalidates the link even though the signature is intact.
    if ((parsed.n ?? null) !== (nonce ?? null)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return parsed.id;
  } catch {
    return null;
  }
}
