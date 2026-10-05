/**
 * Personal invitation links. A token is `<invitation id>.<signature>`; it is
 * rebuilt from the id when an email is sent, so the raw token is never stored.
 * Only its hash is kept, as the lookup key.
 */
import "server-only";

import crypto from "crypto";

function secret(): string {
  return process.env.EVENT_INVITE_SECRET ?? process.env.MARKETING_UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function inviteToken(invitationId: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(`event-invite:${invitationId}`).digest("base64url").slice(0, 32);
  return `${invitationId}.${sig}`;
}

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** The invitation id when the signature is valid, otherwise null. */
export function verifyInviteToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = inviteToken(id).split(".")[1];
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}
