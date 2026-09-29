/**
 * Social Media Hub rules (build-spec §9). v1: fixed, not configurable.
 *   - approve before publishing (on)
 *   - rewrite per account (on — identical copy across accounts gets throttled)
 *   - skip the slot if the queue is empty (on)
 *   - auto-publish (off — a human always approves)
 */
export const SOCIAL_RULES = {
  approveBeforePublish: true,
  rewritePerAccount: true,
  skipSlotIfQueueEmpty: true,
  autoPublish: false,
} as const;

/** Retry backoff after a failed publish attempt: 1m, 5m, 25m, then give up (§9). */
const BACKOFF_MS = [60_000, 5 * 60_000, 25 * 60_000];

/** Delay to the next retry given how many attempts have now failed (1-based).
 *  Returns null once the retries are exhausted → mark the variant failed. */
export function backoffMsFor(attempts: number): number | null {
  return attempts >= 1 && attempts <= BACKOFF_MS.length ? BACKOFF_MS[attempts - 1] : null;
}
