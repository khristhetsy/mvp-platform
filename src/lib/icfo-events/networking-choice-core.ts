/**
 * Who has said no to networking.
 *
 * Stored on the registration's own answers, not on the account: most people
 * registered as guests, and a guest has no profile to hang a preference on.
 * Silence is not a no. Everyone registered stays in the pool until they say so.
 */

export const NETWORKING_OPT_OUT_KEY = "networking_opt_out";

export function isNetworkingOptOut(answers: unknown): boolean {
  return Boolean(
    answers && typeof answers === "object" &&
    (answers as Record<string, unknown>)[NETWORKING_OPT_OUT_KEY] === true,
  );
}

/** The answers with the choice applied. A yes removes the flag rather than storing a true. */
export function withNetworkingChoice(
  answers: Record<string, unknown> | null | undefined,
  optedIn: boolean,
): Record<string, unknown> {
  const next = { ...(answers ?? {}) };
  if (optedIn) delete next[NETWORKING_OPT_OUT_KEY];
  else next[NETWORKING_OPT_OUT_KEY] = true;
  return next;
}
