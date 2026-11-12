import type { PlanType, SubscriptionStatus } from "@/lib/subscriptions/plans";

/** The page a founder is held on until their first payment is confirmed. */
export const PAYMENT_PAGE = "/billing/start";

/** Self serve paid founder plans. The SPV Program (managed IR) is priced on request, so it is never held for payment. */
const PAY_FIRST_PLANS: readonly PlanType[] = ["founder_basic", "founder_professional", "founder_premium"];

export function isPayFirstPlan(plan: PlanType | string | null | undefined): boolean {
  return PAY_FIRST_PLANS.includes(plan as PlanType);
}

/**
 * A founder who chose a paid plan and has not paid yet. Sign up creates the
 * subscription as pending_payment, and only the payment webhook (or staff
 * marking a wire received) moves it to active, so this cannot be skipped from
 * the browser.
 */
export function requiresPaymentFirst(
  subscription: { plan_type: PlanType | string; subscription_status: SubscriptionStatus | string } | null | undefined,
): boolean {
  if (!subscription) return false;
  return subscription.subscription_status === "pending_payment" && isPayFirstPlan(subscription.plan_type);
}
