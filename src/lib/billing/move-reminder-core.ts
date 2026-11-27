// The reminder a Lemon Squeezy customer gets before their renewal, asking them to add their
// card on Stripe. This file is the pure part: who is eligible and how a send is keyed, so a
// rerun never sends twice. No database and no email here, so it is unit tested.

import { describeMove } from "@/lib/billing/admin-checkout";
import { isCardPlan } from "@/lib/billing/plan-change";
import { isStripePlan, keepsLegacyPrice, lemonRenewalAnchor } from "@/lib/billing/stripe-mapping";
import { LEMON_SQUEEZY_PRICES } from "@/lib/billing/webhook-mapping";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";

/** Kill switch (platform_settings, value { "enabled": boolean }). No row means OFF. */
export const MOVE_REMINDER_ENABLED_KEY = "billing_move_reminder_enabled";
/** How many days before the renewal the reminder goes out (platform_settings, value { "days": number }). */
export const MOVE_REMINDER_WINDOW_KEY = "billing_move_reminder_window_days";
export const DEFAULT_MOVE_REMINDER_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 31;

export const MOVE_REMINDER_SENT = "billing.move_reminder.sent";
export const MOVE_REMINDER_WOULD_SEND = "billing.move_reminder.would_send";
export const MOVE_REMINDER_FAILED = "billing.move_reminder.failed";

export type MoveReminderSubscription = {
  id: string;
  profile_id: string;
  plan_type: string | null;
  subscription_status: string | null;
  ls_subscription_id: string | null;
  ls_variant_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  cancel_at_period_end: boolean | null;
  grace_period_ends_at: string | null;
  current_period_end: string | null;
  monthly_price_cents: number | null;
};

export type MoveReminderProfile = { email: string | null; full_name: string | null; role: string | null };

export type MoveReminderSkip =
  | "not_active"
  | "not_lemon"
  | "already_on_stripe"
  | "plan_not_included"
  | "cancelling"
  | "outside_window"
  | "no_email"
  | "internal_account"
  | "price_mismatch";

export type MoveReminderRecipient = {
  subscriptionId: string;
  profileId: string;
  email: string;
  firstName: string | null;
  plan: PlanType;
  priceCents: number;
  renewsAt: string;
};

export function clampWindowDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MOVE_REMINDER_WINDOW_DAYS;
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.round(n)));
}

/** One reminder per subscription per renewal: the key changes when the renewal date does. */
export function moveReminderKey(subscriptionId: string, currentPeriodEnd: string): string {
  return `${subscriptionId}:${new Date(currentPeriodEnd).toISOString()}`;
}

/** "$49" or "$49.50". */
export function formatMonthlyPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toLocaleString("en-US") : dollars.toFixed(2)}`;
}

/**
 * Whether this customer gets the reminder now. Only a live Lemon Squeezy card subscription on
 * Basic or Professional, renewing inside the window, with no Stripe subscription yet. Premium,
 * free, unpaid and internal accounts never qualify, and neither does a subscription that is set
 * to cancel (it has no renewal).
 *
 * The price in the email is the customer's own monthly_price_cents. If that is not the price the
 * move link would actually charge, the customer is skipped: an email must never promise a price
 * the checkout does not honour.
 */
export function evaluateMoveReminder(
  sub: MoveReminderSubscription,
  profile: MoveReminderProfile | null,
  opts: { now: Date; windowDays: number },
): { recipient: MoveReminderRecipient } | { skip: MoveReminderSkip } {
  if (sub.subscription_status !== "active") return { skip: "not_active" };
  if (!sub.ls_subscription_id) return { skip: "not_lemon" };
  if (sub.stripe_subscription_id) return { skip: "already_on_stripe" };
  const plan = sub.plan_type;
  if (!isCardPlan(plan) || !isStripePlan(plan)) return { skip: "plan_not_included" };
  if (sub.cancel_at_period_end) return { skip: "cancelling" };

  const end = sub.current_period_end ? Date.parse(sub.current_period_end) : NaN;
  const horizon = opts.now.getTime() + opts.windowDays * 86_400_000;
  // lemonRenewalAnchor is the move link's own rule: under an hour away, Stripe would charge at
  // checkout, and the email says nothing is charged today.
  if (!Number.isFinite(end) || end > horizon || lemonRenewalAnchor(sub.current_period_end, opts.now) === null) {
    return { skip: "outside_window" };
  }
  if (!describeMove(sub, plan).moving) return { skip: "plan_not_included" };

  const email = profile?.email?.trim() ?? "";
  if (!email) return { skip: "no_email" };
  if (isInternalAccount({ email, role: profile?.role ?? null })) return { skip: "internal_account" };

  const charged = keepsLegacyPrice(sub, plan, opts.now) ? LEMON_SQUEEZY_PRICES[plan] ?? PLAN_PRICES[plan] : PLAN_PRICES[plan];
  const priceCents = sub.monthly_price_cents ?? 0;
  if (priceCents <= 0 || priceCents !== charged) return { skip: "price_mismatch" };

  return {
    recipient: {
      subscriptionId: sub.id,
      profileId: sub.profile_id,
      email,
      firstName: profile?.full_name?.trim().split(/\s+/)[0] || null,
      plan,
      priceCents,
      renewsAt: new Date(end).toISOString(),
    },
  };
}
