/**
 * Column text for Admin → Stuck founders: what the last weekly nudge said, and
 * why a founder hasn't been nudged. Mirrors the rules in
 * nudgeStalledJourneyFounders (Ready stage, company unchanged for 5 days,
 * not awaiting iCFO review).
 */
export const NUDGE_INACTIVE_DAYS = 5;

/** "2 documents left before investor matching" → "2 documents left"; anything else is the general reminder. */
export function nudgeSummary(title: string | null | undefined): string {
  const m = /^(\d+ documents? left)\b/.exec((title ?? "").trim());
  return m ? m[1] : "General reminder";
}

export function notSentReason(input: {
  stage: string;
  companyUpdatedAt: string | null;
  approvalStatus: string | null;
  now?: Date;
}): string {
  if (input.stage !== "qualify") return "Not in Ready yet";
  if (input.approvalStatus === "pending") return "Waiting on iCFO review";
  const now = input.now ?? new Date();
  const cutoff = now.getTime() - NUDGE_INACTIVE_DAYS * 86_400_000;
  const updated = input.companyUpdatedAt ? new Date(input.companyUpdatedAt).getTime() : NaN;
  if (!Number.isNaN(updated) && updated >= cutoff) return `Active in last ${NUDGE_INACTIVE_DAYS} days`;
  return "Due on the next daily run";
}

/** True when the nudge was sent within the last `days` days. */
export function nudgedWithin(createdAt: string, days: number, now: Date = new Date()): boolean {
  const t = new Date(createdAt).getTime();
  return !Number.isNaN(t) && t >= now.getTime() - days * 86_400_000;
}
