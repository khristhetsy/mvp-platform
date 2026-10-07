/**
 * Outreach allowance status for the admin Companies list: is a paid founder
 * getting their plan's outreach this 30 day window? Pure, so the list and the
 * tests read it the same way.
 */
import { OUTREACH_RUN_INTERVAL_MS } from "@/lib/outreach/outreach-schedule";

export type AllowanceStatus = "full" | "on_pace" | "behind" | "stalled";

export type AllowanceInput = {
  cap: number | null; // plan limit, null = uncapped
  reached: number;
  windowEnd: Date;
  /** Next automated run, or null when no active campaign will run (none, paused, automation off). */
  nextRunAt: Date | null;
  /** Most investors one run can send. */
  perRun: number;
  /** Something stopping sends: "unpublished" profile, an admin pause, etc. */
  blockedReason: string | null;
};

/** Runs that start before the window resets, from the next run, one every interval. */
export function runsLeft(nextRunAt: Date | null, windowEnd: Date): number {
  if (!nextRunAt) return 0;
  let n = 0;
  for (let t = nextRunAt.getTime(); t < windowEnd.getTime(); t += OUTREACH_RUN_INTERVAL_MS) n++;
  return n;
}

export function allowanceStatus(i: AllowanceInput): { status: AllowanceStatus; projected: number | null } {
  if (i.cap !== null && i.reached >= i.cap) return { status: "full", projected: i.reached };
  if (i.blockedReason || !i.nextRunAt) return { status: "stalled", projected: i.reached };
  if (i.cap === null) return { status: "on_pace", projected: null };
  const projected = Math.min(i.cap, i.reached + runsLeft(i.nextRunAt, i.windowEnd) * Math.max(0, i.perRun));
  return { status: projected >= i.cap ? "on_pace" : "behind", projected };
}
