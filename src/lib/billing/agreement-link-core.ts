import crypto from "crypto";

/**
 * Premium for an admin created account: the client cannot sign in (the demo login holds a
 * placeholder address), so the link the admin sends opens an agreement page instead. This is
 * the signed token in that link: it names one organization and is never valid for any other
 * kind of token. Pure, so it is unit tested.
 */
const DOMAIN = "agreementlink:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(orgId: string): string {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
  return crypto.createHmac("sha256", secret).update(DOMAIN + orgId).digest("hex").slice(0, 32);
}

export function makeAgreementLinkToken(orgId: string): string {
  return `${orgId}.${sign(orgId)}`;
}

export function verifyAgreementLinkToken(token: string | null | undefined): string | null {
  if (!token || token.length > 120 || !token.includes(".")) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !UUID.test(id)) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}

export function agreementLinkPath(token: string): string {
  return `/agreement/premium?t=${encodeURIComponent(token)}`;
}
