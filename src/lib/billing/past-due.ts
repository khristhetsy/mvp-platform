// Failed renewal payments: when a subscription is past due, how long is left,
// and how the grace window is kept stable across repeated LemonSqueezy events.
//
// Pure functions only, so the webhook, the banner and the tests share one
// definition. The grace length itself lives in webhook-mapping.ts
// (PAST_DUE_GRACE_DAYS).

import type { SubscriptionRecord } from "@/lib/subscriptions/plans";

type PastDueFields = Pick<SubscriptionRecord, "subscription_status" | "grace_period_ends_at" | "cancel_at_period_end">;

/**
 * "grace": card failed, access still on, countdown running.
 * "lapsed": card failed and the countdown has run out, access is off.
 * null: not a failed payment.
 *
 * grace_period_ends_at is also used for a cancellation that runs to the end of
 * the paid period. That case has cancel_at_period_end set, so it is excluded.
 */
export type PastDueState = "grace" | "lapsed" | null;

export function pastDueState(sub: PastDueFields, now: Date = new Date()): PastDueState {
  if (sub.subscription_status !== "active") return null;
  if (!sub.grace_period_ends_at) return null;
  if (sub.cancel_at_period_end) return null;
  return new Date(sub.grace_period_ends_at).getTime() > now.getTime() ? "grace" : "lapsed";
}

export function graceDaysLeft(endsAt: string, now: Date = new Date()): number {
  const ms = new Date(endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** "Nov 2, 2026". Pacific time, matching the rest of the platform. */
export function formatPtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

type GraceInput = {
  existingEndsAt: string | null;
  existingCancelAtPeriodEnd: boolean;
  mappedEndsAt: string | null;
  mappedCancelAtPeriodEnd: boolean;
};

function isFailedPaymentWindow(endsAt: string | null, cancelAtPeriodEnd: boolean) {
  return Boolean(endsAt) && !cancelAtPeriodEnd;
}

/**
 * LemonSqueezy can send several past_due events for one failed payment (one per
 * retry). mapStatus stamps now + N days each time, which would restart the
 * countdown on every retry and stretch a 5 day window indefinitely. While the
 * subscription stays past due, keep the date from the first failure.
 */
export function keepGraceWindow(input: GraceInput): string | null {
  const mappedFailed = isFailedPaymentWindow(input.mappedEndsAt, input.mappedCancelAtPeriodEnd);
  const existingFailed = isFailedPaymentWindow(input.existingEndsAt, input.existingCancelAtPeriodEnd);
  if (mappedFailed && existingFailed) return input.existingEndsAt;
  return input.mappedEndsAt;
}

/** True only on the event that moves a subscription into past due. */
export function isNewPastDue(input: GraceInput): boolean {
  return (
    isFailedPaymentWindow(input.mappedEndsAt, input.mappedCancelAtPeriodEnd) &&
    !isFailedPaymentWindow(input.existingEndsAt, input.existingCancelAtPeriodEnd)
  );
}
