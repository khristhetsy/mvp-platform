// Pure mapping between LemonSqueezy payload values and our internal plan model.
//
// Extracted from the webhook route so it can be unit tested — these functions
// decide what a paying customer gets, and previously nothing exercised them.

import type { LsSubscriptionStatus } from "@/lib/lemonsqueezy";
import type { SubscriptionStatus, PlanType } from "@/lib/subscriptions/plans";

/**
 * How long a `past_due` subscriber keeps access while their card is retried.
 *
 * Previously `past_due` mapped straight to `active` with no bound, so a failed
 * card kept full access indefinitely — every subsequent `past_due` event
 * rewrote `active` again. This makes the grace period explicit and finite.
 */
export const PAST_DUE_GRACE_DAYS = 14;

export type StatusMapping = {
  status: SubscriptionStatus;
  /** When set, access should end at this instant even if status reads active. */
  gracePeriodEndsAt: string | null;
  /** True when LemonSqueezy sent a status we don't recognise. */
  unknown: boolean;
};

/**
 * Map a LemonSqueezy status to ours.
 *
 * An unrecognised status is reported rather than silently treated as cancelled.
 * The old `default: return "canceled"` meant LemonSqueezy adding an enum value
 * could deactivate paying customers with no signal.
 */
export function mapStatus(ls: LsSubscriptionStatus | string, now: Date = new Date()): StatusMapping {
  switch (ls) {
    case "active":
      return { status: "active", gracePeriodEndsAt: null, unknown: false };
    case "on_trial":
      return { status: "trialing", gracePeriodEndsAt: null, unknown: false };
    case "past_due": {
      const ends = new Date(now.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
      return { status: "active", gracePeriodEndsAt: ends.toISOString(), unknown: false };
    }
    case "cancelled":
    case "paused":
    case "unpaid":
    case "expired":
      return { status: "canceled", gracePeriodEndsAt: null, unknown: false };
    default:
      // Unknown: keep the subscription as-is rather than cancelling. The caller
      // logs this and returns non-200 so the event is retried and noticed.
      return { status: "active", gracePeriodEndsAt: null, unknown: true };
  }
}

export type PlanResolution = {
  plan: PlanType | null;
  /** How the plan was determined — "name" is a fallback and worth alerting on. */
  source: "variant_id" | "name" | "none";
};

/**
 * Resolve a plan from the LemonSqueezy variant.
 *
 * Numeric variant IDs are authoritative. The product-name fallback exists for
 * environments where those env vars aren't set, but it is fragile — renaming the
 * product in the LemonSqueezy dashboard silently breaks it — so the source is
 * reported and the caller warns when it's used.
 */
export function variantToPlan(
  variantId: number,
  variantName?: string | null,
  productName?: string | null,
): PlanResolution {
  const basic = process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
  const pro = process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
  if (basic && String(variantId) === basic) return { plan: "founder_basic", source: "variant_id" };
  if (pro && String(variantId) === pro) return { plan: "founder_professional", source: "variant_id" };

  const name = `${productName ?? ""} ${variantName ?? ""}`.toLowerCase();
  if (name.includes("professional")) return { plan: "founder_professional", source: "name" };
  if (name.includes("basic")) return { plan: "founder_basic", source: "name" };
  return { plan: null, source: "none" };
}
