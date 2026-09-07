/**
 * Resolve the public origin (scheme + host) the browser actually used, from the
 * incoming request. On Vercel behind the edge proxy, request.url can carry the
 * internal deployment host (mvp-platform-*.vercel.app) rather than the custom domain,
 * which then goes out as the OAuth redirect_uri and fails the provider's exact-match
 * check. The forwarded headers carry the real host the user hit (icapos.com), so we
 * prefer those. Host-header spoofing isn't a concern here: the redirect_uri still has
 * to be in the provider's registered allowlist to be accepted.
 */
export function originFromRequest(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.split(",")[0]?.trim();
  if (host) return `${proto || "https"}://${host}`;
  return new URL(request.url).origin;
}
