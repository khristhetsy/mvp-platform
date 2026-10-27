/**
 * Central act on behalf: pure rules, no server imports, so they can be unit tested.
 *
 * While a staff member is acting as a founder, every founder page and route runs as
 * that founder (see acting-central.ts). It is off unless ACT_AS_FOUNDER_CENTRAL=1,
 * so turning it off is one environment variable.
 */
export const ZONE_HEADER = "x-icapos-zone";

/** How long a verified acting decision is reused before it is checked again. */
export const VERDICT_TTL_MS = 30_000;

export function isCentralActingEnabled(value: string | null | undefined): boolean {
  return value === "1";
}

/**
 * Staff screens keep the staff identity. Only founder screens and the shared API
 * routes the founder app calls run as the founder. The zone is set by the proxy for
 * /admin, /investor and /founder paths; it is empty for every other route.
 */
export function centralActingApplies(zone: string | null | undefined): boolean {
  return zone !== "admin" && zone !== "investor";
}

/** When to mint a new founder session: 5 minutes before the access token would expire. */
export function sessionExpiryMs(expiresInSeconds: number | null | undefined, now: number): number {
  const seconds = typeof expiresInSeconds === "number" && expiresInSeconds > 0 ? expiresInSeconds : 3600;
  return now + Math.max(60_000, seconds * 1000 - 5 * 60_000);
}
