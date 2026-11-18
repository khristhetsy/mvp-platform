/** Opens the existing Settings Connect Google flow and returns to Settings. */
export const GOOGLE_CONNECT_PATH = "/api/integrations/google/connect?returnTo=/founder/settings";

/**
 * A founder can hold more than one profile row for the same email. They need the
 * nudge only when they have an account and none of their accounts has Google.
 * No account at all means there is nothing to connect it to, so no nudge.
 */
export function needsGoogleNudge(profileIds: string[], connectedUserIds: string[]): boolean {
  if (!profileIds.length) return false;
  const connected = new Set(connectedUserIds);
  return !profileIds.some((id) => connected.has(id));
}
