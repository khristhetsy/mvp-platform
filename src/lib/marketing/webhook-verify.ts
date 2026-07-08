import { createHmac, timingSafeEqual } from "crypto";

// Verify a Resend (Svix) webhook signature. The signed content is
// `${id}.${timestamp}.${rawBody}`, HMAC-SHA256'd with the base64 secret that
// follows the `whsec_` prefix; `svix-signature` is a space-separated list of
// `v1,<base64sig>` entries. See https://docs.svix.com/receiving/verifying-payloads.
export function verifySvixSignature(
  secret: string,
  id: string,
  timestamp: string,
  signature: string,
  rawBody: string,
  opts: { skewSeconds?: number; nowMs?: number } = {},
): boolean {
  if (!secret || !id || !timestamp || !signature) return false;
  // Reject stale deliveries (default >5 min skew) to blunt replay attacks.
  const skew = opts.skewSeconds ?? 60 * 5;
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const ts = Number(timestamp);
  if (Number.isFinite(ts) && Math.abs(nowSec - ts) > skew) return false;

  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected);
  return signature.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

/** Compute a valid `svix-signature` header value for a payload — used in tests and tooling. */
export function signSvix(secret: string, id: string, timestamp: string, rawBody: string): string {
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
  const sig = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return `v1,${sig}`;
}
