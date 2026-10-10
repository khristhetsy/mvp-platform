/**
 * Founder plan rules for the free due diligence offer (approved Oct 9, 2026).
 *
 * Pure: every function takes the subscription row (or the part of it that
 * matters) so the APIs, the pages and the tests read one rule.
 *
 *  - A non grandfathered Free founder gets ONE AI due diligence report. The
 *    report and the CRR stay free; running it again is a Basic feature.
 *  - Interested investors are hidden from Free (and legacy trial) founders until
 *    they upgrade. This applies only to the investor interest surfaces; it does
 *    not change founderEntitlements(), which grandfathered accounts rely on.
 */
import type { PlanType, SubscriptionRecord } from "@/lib/subscriptions/plans";

export type FounderSubscriptionLike =
  | Pick<SubscriptionRecord, "plan_type" | "is_grandfathered" | "subscription_status">
  | null
  | undefined;

export const FREE_REPORT_LIMIT_MESSAGE =
  "Your free plan includes one AI due diligence report. Upgrade to Basic to run it again as your documents change.";

export const UPGRADE_BASIC_HREF = "/upgrade?plan=founder_basic";
export const UPGRADE_PREMIUM_HREF = "/upgrade?plan=founder_premium";

/**
 * A Free founder on the narrowed plan. Fail open like access.ts: only an
 * explicit is_grandfathered === false narrows, so the grandfathered accounts
 * keep everything they had.
 */
export function isRestrictedFreeFounder(sub: FounderSubscriptionLike): boolean {
  return sub?.plan_type === "founder_free" && sub.is_grandfathered === false;
}

/** True when this founder may not generate another diligence report. */
export function freeReportLimitReached(sub: FounderSubscriptionLike, existingReportCount: number): boolean {
  return isRestrictedFreeFounder(sub) && existingReportCount > 0;
}

const MASKED_PLANS: ReadonlySet<PlanType> = new Set<PlanType>(["founder_free", "founder_trial"]);

/**
 * Whether investor names and firms are hidden on the investor interest page.
 * Free and legacy trial founders see a masked row; Basic and up see names. A
 * paid plan that has not been paid yet (pending_payment) is still masked, and
 * so is a missing subscription row.
 */
export function masksInvestorInterest(sub: FounderSubscriptionLike): boolean {
  if (!sub) return true;
  // Unpaid or lapsed (pending checkout, Premium paused for an overdue wire,
  // canceled) sees interest the same way Free does.
  if (sub.subscription_status === "pending_payment" || sub.subscription_status === "expired" || sub.subscription_status === "canceled") return true;
  return MASKED_PLANS.has(sub.plan_type);
}
