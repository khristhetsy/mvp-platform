/**
 * Pure parsing helpers for the inbound-email webhook. Provider-agnostic and
 * I/O-free so they can be unit-tested — this is the security-relevant path that
 * decides which thread (and therefore which user) an inbound reply belongs to.
 */

export type InboundPayload = Record<string, unknown>;

/** First non-empty string value among the given keys (handles array fields). */
export function pickField(payload: InboundPayload, ...keys: string[]): string {
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].length > 0) return v[0];
  }
  return "";
}

/**
 * Extract the thread reply token from a recipient address of the form
 * `reply+<token>@domain`. Returns null when no token is present.
 */
export function extractReplyToken(to: string): string | null {
  const m = to.match(/reply\+([a-zA-Z0-9]+)@/i);
  return m ? m[1] : null;
}

/** Split a From header into email + optional display name. */
export function parseFromHeader(from: string): { email: string; name: string | null } {
  const angle = from.match(/<([^>]+)>/);
  if (angle) {
    const name = from.slice(0, from.indexOf("<")).trim().replace(/^"|"$/g, "");
    return { email: angle[1].trim().toLowerCase(), name: name || null };
  }
  return { email: from.trim().toLowerCase(), name: null };
}
