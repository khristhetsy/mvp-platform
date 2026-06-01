const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 15 * 60_000;

export function computeNextRetryAt(attemptCount: number): Date {
  const delay = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attemptCount - 1), MAX_DELAY_MS);
  return new Date(Date.now() + delay);
}

export function shouldRetryDelivery(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount < maxAttempts;
}

export const DEFAULT_MAX_ATTEMPTS = 4;
