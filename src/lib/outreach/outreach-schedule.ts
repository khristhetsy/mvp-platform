/**
 * When the next automated outreach batch goes out.
 *
 * The weekly send pass (processApprovedOutreach) runs inside the orchestration
 * cron, scheduled in vercel.json for 07:00 and 19:00 UTC. A campaign sends at
 * most once every 6 days: it is picked up by the first run after
 * last_run_at + 6 days. outreach-schedule.test.ts checks these hours against
 * vercel.json, so changing the cron there without updating this fails the tests.
 *
 * Pure functions only.
 */
export const OUTREACH_RUN_HOURS_UTC = [7, 19] as const;
export const OUTREACH_RUN_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

/** The first scheduled run at or after `at`. */
export function nextCronSlot(at: Date): Date {
  const day = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  for (let d = 0; d < 3; d++) {
    for (const h of OUTREACH_RUN_HOURS_UTC) {
      const slot = new Date(day + d * 86_400_000 + h * 3_600_000);
      if (slot.getTime() >= at.getTime()) return slot;
    }
  }
  return at;
}

/** "2026-10-20" (a UTC date) → the instant that day starts. */
function dayStart(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

/**
 * The run that will pick this campaign up next: after the 6 day spacing, a
 * start date, and an automation pause (which holds through its resume day).
 */
export function nextOutreachRun(
  input: { lastRunAt?: string | null; startDate?: string | null; pauseUntil?: string | null; notBefore?: Date | null },
  now: Date = new Date(),
): Date {
  let earliest = now.getTime();
  if (input.lastRunAt) earliest = Math.max(earliest, new Date(input.lastRunAt).getTime() + OUTREACH_RUN_INTERVAL_MS + 1);
  if (input.startDate) earliest = Math.max(earliest, dayStart(input.startDate).getTime());
  if (input.pauseUntil) earliest = Math.max(earliest, dayStart(input.pauseUntil).getTime() + 86_400_000);
  if (input.notBefore) earliest = Math.max(earliest, input.notBefore.getTime());
  return nextCronSlot(new Date(earliest));
}

/**
 * Every date and time founders see for outreach is in Pacific time (PT), so
 * there is one time zone across emails, notices and pages. The cron itself
 * still runs on UTC hours above; only the display is converted.
 */
export const OUTREACH_DISPLAY_TZ = "America/Los_Angeles";

/** "12:00 PM PT" */
export function formatRunClock(at: Date): string {
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: OUTREACH_DISPLAY_TZ }).format(at);
  return `${time} PT`;
}

/** "Friday, October 9" (Pacific date). */
export function formatRunDay(at: Date): string {
  return at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: OUTREACH_DISPLAY_TZ });
}

/** "October 9" (Pacific date). */
export function formatShortDay(at: Date): string {
  return at.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: OUTREACH_DISPLAY_TZ });
}

/** "Friday, October 9 around 12:00 PM PT" for founder facing copy. */
export function formatRunTime(at: Date): string {
  return `${formatRunDay(at)} around ${formatRunClock(at)}`;
}
