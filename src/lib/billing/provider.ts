import "server-only";
import { cancelSubscription, changeSubscriptionVariant, resumeSubscription } from "@/lib/lemonsqueezy";
import { stripeCancelAtPeriodEnd, stripeChangePrice, stripeResume } from "@/lib/stripe";

/**
 * Which provider bills a subscription, and the renewal actions that go through it.
 *
 * A row with a stripe_subscription_id is billed by Stripe; otherwise a row with an
 * ls_subscription_id is billed by Lemon Squeezy (shutting down March 31, 2027).
 * Callers pass the row and do not need to know which one it is.
 */
export type BillingRef = {
  ls_subscription_id?: string | null;
  stripe_subscription_id?: string | null;
};

export type BillingProvider = "stripe" | "lemonsqueezy";

export function billingProviderOf(ref: BillingRef | null | undefined): BillingProvider | null {
  if (ref?.stripe_subscription_id) return "stripe";
  if (ref?.ls_subscription_id) return "lemonsqueezy";
  return null;
}

/** Stop renewal at the end of the paid period. Access runs to the end. */
export async function cancelRenewal(ref: BillingRef): Promise<void> {
  const provider = billingProviderOf(ref);
  if (provider === "stripe") return stripeCancelAtPeriodEnd(ref.stripe_subscription_id as string);
  if (provider === "lemonsqueezy") return cancelSubscription(ref.ls_subscription_id as string);
  throw new Error("No billing subscription to cancel.");
}

/** Undo a cancellation that has not reached its end date. */
export async function resumeRenewal(ref: BillingRef): Promise<void> {
  const provider = billingProviderOf(ref);
  if (provider === "stripe") return stripeResume(ref.stripe_subscription_id as string);
  if (provider === "lemonsqueezy") return resumeSubscription(ref.ls_subscription_id as string);
  throw new Error("No billing subscription to resume.");
}

/**
 * Move a subscription to another plan's price at the next renewal.
 * `lsVariantId` and `stripePriceId` are the target plan's ids for each provider.
 */
export async function changeRenewalPlan(
  ref: BillingRef,
  target: { lsVariantId: string | null; stripePriceId: string | null },
): Promise<void> {
  const provider = billingProviderOf(ref);
  if (provider === "stripe") {
    if (!target.stripePriceId) throw new Error("The target Stripe price is not configured.");
    return stripeChangePrice(ref.stripe_subscription_id as string, target.stripePriceId);
  }
  if (provider === "lemonsqueezy") {
    if (!target.lsVariantId) throw new Error("The target Lemon Squeezy variant is not configured.");
    return changeSubscriptionVariant(ref.ls_subscription_id as string, target.lsVariantId);
  }
  throw new Error("No billing subscription to change.");
}
