import type { PlanType } from "@/lib/subscriptions/plans";

/** Plans billed by card through Lemon Squeezy. Premium is a card plan too, but it also
 * exists as a bank wire plan: see isCardSubscription and isWirePremium. */
export const CARD_PLANS: readonly PlanType[] = ["founder_basic", "founder_professional"] as const;

export type DowngradeTarget = "basic" | "free";

export function isCardPlan(plan: PlanType | string | null | undefined): boolean {
  return plan === "founder_basic" || plan === "founder_professional";
}

type BillingSub = { plan_type?: string | null; ls_subscription_id?: string | null } | null | undefined;

/**
 * A subscription that Lemon Squeezy bills: Basic, Professional or Premium with a
 * Lemon Squeezy subscription id. Premium without one is a bank wire subscription.
 * Cancelling, stopping payment and account deletion must go through Lemon Squeezy
 * for every card subscription, or it keeps charging.
 */
export function isCardSubscription(sub: BillingSub): boolean {
  if (!sub?.ls_subscription_id) return false;
  return isCardPlan(sub.plan_type) || sub.plan_type === "founder_premium";
}

/** Premium paid by bank wire (no Lemon Squeezy subscription). */
export function isWirePremium(sub: BillingSub): boolean {
  return sub?.plan_type === "founder_premium" && !sub.ls_subscription_id;
}

/** Professional can move to Basic or Free. Basic can move to Free. */
export function canDowngrade(from: PlanType | string, to: DowngradeTarget): boolean {
  if (from === "founder_professional") return to === "basic" || to === "free";
  if (from === "founder_basic") return to === "free";
  return false;
}

export type CardTarget = "professional" | "basic";

/** Premium (wire) can move to a card plan. The card plan starts at checkout, after the Premium period. */
export function canSwitchFromPremium(from: PlanType | string, to: CardTarget): boolean {
  return from === "founder_premium" && (to === "professional" || to === "basic");
}

export function cardPlanFor(target: CardTarget): PlanType {
  return target === "professional" ? "founder_professional" : "founder_basic";
}

/** A founder who chose a card plan and has not paid for it yet: shown a "Start plan" prompt. */
export function awaitingCardCheckout(sub: {
  plan_type: string;
  pending_plan_type?: string | null;
  ls_subscription_id?: string | null;
}): boolean {
  return sub.plan_type === "founder_free" && isCardPlan(sub.pending_plan_type) && !sub.ls_subscription_id;
}

export function pendingPlanFor(target: DowngradeTarget): PlanType {
  return target === "basic" ? "founder_basic" : "founder_free";
}

/**
 * Lemon Squeezy applies a plan change immediately, and a renewal charges the
 * variant the subscription is on at that moment. To avoid one more charge at the
 * old price, a scheduled change is applied this long before the period ends.
 */
export const DOWNGRADE_LEAD_MS = 24 * 60 * 60 * 1000;

export function isDowngradeDue(effectiveAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!effectiveAt) return false;
  const at = Date.parse(effectiveAt);
  return Number.isFinite(at) && at - DOWNGRADE_LEAD_MS <= now.getTime();
}
