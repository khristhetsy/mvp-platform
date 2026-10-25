import type { PlanType } from "@/lib/subscriptions/plans";

/** Plans billed by card through Lemon Squeezy. Premium is paid by bank wire. */
export const CARD_PLANS: readonly PlanType[] = ["founder_basic", "founder_professional"] as const;

export type DowngradeTarget = "basic" | "free";

export function isCardPlan(plan: PlanType | string | null | undefined): boolean {
  return plan === "founder_basic" || plan === "founder_professional";
}

/** Professional can move to Basic or Free. Basic can move to Free. */
export function canDowngrade(from: PlanType | string, to: DowngradeTarget): boolean {
  if (from === "founder_professional") return to === "basic" || to === "free";
  if (from === "founder_basic") return to === "free";
  return false;
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
