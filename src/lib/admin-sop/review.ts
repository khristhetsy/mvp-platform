/**
 * When the Operations Manual was last checked against the platform, and how often
 * it should be. Update MANUAL_LAST_REVIEWED when you finish a review (the monthly
 * reminder task prompts it).
 */
export const MANUAL_LAST_REVIEWED = "2026-11-19";
export const MANUAL_REVIEW_INTERVAL_DAYS = 30;

const DAY_MS = 86_400_000;

export interface ManualReviewStatus {
  lastReviewed: string;
  nextReview: string;
  daysSince: number;
  due: boolean;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function manualReviewStatus(
  now: Date = new Date(),
  lastReviewed: string = MANUAL_LAST_REVIEWED,
  intervalDays: number = MANUAL_REVIEW_INTERVAL_DAYS,
): ManualReviewStatus {
  const last = Date.parse(`${lastReviewed}T00:00:00Z`);
  const daysSince = Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));
  return {
    lastReviewed,
    nextReview: isoDay(last + intervalDays * DAY_MS),
    daysSince,
    due: daysSince > intervalDays,
  };
}
