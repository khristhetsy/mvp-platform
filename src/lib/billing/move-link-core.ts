import crypto from "crypto";

/**
 * The link in the "add your card" email that moves a Lemon Squeezy subscriber to Stripe. A Stripe
 * checkout link expires after a day, so the email links to an iCapOS page instead, and that page
 * creates a fresh Stripe checkout when the customer clicks. This is the signed token in that
 * link: it names one profile and is never valid for any other kind of token. Pure, so it is
 * unit tested.
 */
const DOMAIN = "movelink:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(profileId: string): string {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
  return crypto.createHmac("sha256", secret).update(DOMAIN + profileId).digest("hex").slice(0, 32);
}

export function makeMoveLinkToken(profileId: string): string {
  return `${profileId}.${sign(profileId)}`;
}

export function verifyMoveLinkToken(token: string | null | undefined): string | null {
  if (!token || token.length > 120 || !token.includes(".")) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !UUID.test(id)) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}

export function moveLinkPath(token: string): string {
  return `/billing/move?t=${encodeURIComponent(token)}`;
}
