// Pure mapping between Stripe values and our internal plan model.
//
// Kept free of the Stripe SDK and the database so the webhook, checkout and the
// tests share one definition of "which plan is this price" and "what does this
// status mean for access". The Lemon Squeezy equivalents live in webhook-mapping.ts.

import { PAST_DUE_GRACE_DAYS, type StatusMapping } from "@/lib/billing/webhook-mapping";
import type { PlanType } from "@/lib/subscriptions/plans";

type Env = Record<string, string | undefined>;

/** Plans sold by card through Stripe. */
export type StripePlan = "founder_basic" | "founder_professional" | "founder_premium";

/**
 * "current" is the price new customers pay ($99 Basic, $199 Professional,
 * $1,500 Premium). "legacy" is the price a continuous subscriber keeps
 * ($49 Basic, $1,000 Premium). Professional has no legacy price: it did not change.
 */
export type PriceTier = "current" | "legacy";

const CURRENT_ENV: Record<StripePlan, string> = {
  founder_basic: "STRIPE_PRICE_BASIC",
  founder_professional: "STRIPE_PRICE_PROFESSIONAL",
  founder_premium: "STRIPE_PRICE_PREMIUM",
};

const LEGACY_ENV: Partial<Record<StripePlan, string>> = {
  founder_basic: "STRIPE_PRICE_BASIC_LEGACY",
  founder_premium: "STRIPE_PRICE_PREMIUM_LEGACY",
};

export const isStripePlan = (plan: string | null | undefined): plan is StripePlan =>
  plan === "founder_basic" || plan === "founder_professional" || plan === "founder_premium";

/** The Stripe price id for a plan and tier, or null when it is not configured. */
export function stripePriceId(plan: StripePlan, tier: PriceTier, env: Env = process.env): string | null {
  const name = tier === "legacy" ? LEGACY_ENV[plan] : CURRENT_ENV[plan];
  const value = name ? env[name]?.trim() : "";
  return value ? value : null;
}

/** Which plan and tier a Stripe price id belongs to. Null for an unknown price. */
export function planFromStripePrice(
  priceId: string | null | undefined,
  env: Env = process.env,
): { plan: StripePlan; tier: PriceTier } | null {
  if (!priceId) return null;
  for (const plan of Object.keys(CURRENT_ENV) as StripePlan[]) {
    if (stripePriceId(plan, "current", env) === priceId) return { plan, tier: "current" };
    if (stripePriceId(plan, "legacy", env) === priceId) return { plan, tier: "legacy" };
  }
  return null;
}

/**
 * Stripe Managed Payments (Stripe as merchant of record, handling sales tax and VAT)
 * only supports fully automated digital products. Stripe's eligibility page lists
 * professional services and anything with human involvement as unsupported, so
 * Premium (done for you by iCFO staff) is off by default.
 * STRIPE_MANAGED_PAYMENTS_PLANS overrides it: a comma separated list of plan types,
 * or "none".
 */
export function managedPaymentsFor(plan: StripePlan, env: Env = process.env): boolean {
  const raw = env.STRIPE_MANAGED_PAYMENTS_PLANS?.trim();
  if (raw === undefined || raw === "") return plan !== "founder_premium";
  if (raw.toLowerCase() === "none") return false;
  return raw.split(",").map((s) => s.trim()).includes(plan);
}

/**
 * When Stripe should take its first payment from a subscriber moving off Lemon
 * Squeezy: the end of the period they already paid for, in Unix seconds. Null when
 * that date is missing, already past, or less than an hour away, in which case the
 * customer is charged at checkout as usual.
 */
export function lemonRenewalAnchor(currentPeriodEnd: string | null | undefined, now: Date = new Date()): number | null {
  if (!currentPeriodEnd) return null;
  const end = Date.parse(currentPeriodEnd);
  if (!Number.isFinite(end) || end - now.getTime() < 60 * 60 * 1000) return null;
  return Math.floor(end / 1000);
}

// ── Who keeps the old price ──────────────────────────────────────────────────

export type PriceHolder = {
  plan_type: string | null;
  subscription_status: string | null;
  ls_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
  grace_period_ends_at: string | null;
};

/**
 * A subscriber keeps the old price only while the subscription is continuous:
 * active, on the same plan they are buying, not set to cancel, and not past due
 * beyond its grace period. Anyone who cancelled and returns, anyone who never
 * paid, and anyone upgrading to a different plan pays the current price.
 *
 * Only a live Lemon Squeezy subscription qualifies: it is the one moving to Stripe.
 * A subscriber already on Stripe keeps their price through their existing Stripe
 * subscription and never checks out again. Wire Premium has no Lemon Squeezy id
 * and is not covered here.
 */
export function keepsLegacyPrice(
  holder: PriceHolder | null | undefined,
  target: StripePlan,
  now: Date = new Date(),
): boolean {
  if (!holder) return false;
  if (target === "founder_professional") return false; // unchanged price, no legacy tier
  if (holder.plan_type !== target) return false;
  if (holder.subscription_status !== "active") return false;
  if (holder.cancel_at_period_end) return false;
  if (!holder.ls_subscription_id) return false;
  if (holder.grace_period_ends_at && new Date(holder.grace_period_ends_at).getTime() <= now.getTime()) return false;
  return true;
}

// ── Status ───────────────────────────────────────────────────────────────────

/**
 * Map a Stripe subscription status to ours.
 *
 * Mirrors mapStatus for Lemon Squeezy: past_due keeps access for the same grace
 * period, a cancellation inside the paid period keeps access until its end, and a
 * status we do not recognise is reported rather than treated as cancelled.
 */
export function mapStripeStatus(
  status: string,
  opts: { cancelAtPeriodEnd: boolean; periodEnd: string | null; now?: Date },
): StatusMapping {
  const now = opts.now ?? new Date();
  const periodEnd = opts.periodEnd ? Date.parse(opts.periodEnd) : NaN;
  const endsInFuture = Number.isFinite(periodEnd) && periodEnd > now.getTime();
  switch (status) {
    case "active":
    case "trialing": {
      const base = status === "trialing" ? "trialing" : "active";
      if (opts.cancelAtPeriodEnd && endsInFuture) {
        return { status: base, gracePeriodEndsAt: new Date(periodEnd).toISOString(), unknown: false, cancelAtPeriodEnd: true };
      }
      return { status: base, gracePeriodEndsAt: null, unknown: false, cancelAtPeriodEnd: false };
    }
    case "past_due": {
      const ends = new Date(now.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
      return { status: "active", gracePeriodEndsAt: ends.toISOString(), unknown: false, cancelAtPeriodEnd: false };
    }
    case "canceled":
    case "unpaid":
    case "paused":
    case "incomplete_expired":
      return { status: "canceled", gracePeriodEndsAt: null, unknown: false, cancelAtPeriodEnd: false };
    case "incomplete":
      // The first payment has not gone through yet. No paid entitlements.
      return { status: "pending_payment", gracePeriodEndsAt: null, unknown: false, cancelAtPeriodEnd: false };
    default:
      return { status: "active", gracePeriodEndsAt: null, unknown: true, cancelAtPeriodEnd: false };
  }
}

/** The plan type to store for a Stripe price, or null when the price is not one of ours. */
export function planTypeFromPrice(priceId: string | null | undefined, env: Env = process.env): PlanType | null {
  return planFromStripePrice(priceId, env)?.plan ?? null;
}
