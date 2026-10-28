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

/**
 * Many calls the staff screens make go to shared routes outside the proxy matcher
 * (notifications, tasks, sales), so they carry no zone. The page that made the call is in
 * the Referer, so a call made from an admin or investor page stays on the staff identity.
 * The Referer can only turn acting off here, never on.
 */
export function zoneFromReferer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  let path: string;
  try {
    path = new URL(referer).pathname;
  } catch {
    return null;
  }
  for (const zone of ["admin", "investor", "founder"]) {
    if (path === `/${zone}` || path.startsWith(`/${zone}/`)) return zone;
  }
  return null;
}

/** The zone header wins; the Referer fills in when the route is outside the proxy matcher. */
export function effectiveZone(zoneHeader: string | null | undefined, referer: string | null | undefined): string | null {
  return zoneHeader ? zoneHeader : zoneFromReferer(referer);
}
