import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";
import { keepsLegacyPrice, lemonRenewalAnchor, managedPaymentsFor, stripePriceId, type PriceHolder } from "@/lib/billing/stripe-mapping";
import { isCardSubscription } from "@/lib/billing/plan-change";

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

export type AdminCheckoutInput = {
  plan: "founder_basic" | "founder_professional" | "founder_premium";
  email: string;
  profileId: string;
  successUrl: string;
  name?: string;
  /**
   * The customer's current subscription row. When it is a live Lemon Squeezy card
   * subscription on this same plan, the link moves it to Stripe: the old price is
   * kept, the first Stripe charge is on the Lemon Squeezy renewal date, and the
   * Lemon Squeezy subscription is cancelled once the card is saved.
   */
  subscription?: (PriceHolder & {
    ls_variant_id?: string | null;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    current_period_end: string | null;
  }) | null;
};

/** What the link will do for this customer, so the email can say it plainly. */
export function describeMove(
  sub: AdminCheckoutInput["subscription"],
  plan: AdminCheckoutInput["plan"],
): { moving: boolean; firstChargeDate: string | null } {
  const moving = Boolean(sub?.ls_subscription_id && !sub.stripe_subscription_id && sub.plan_type === plan && isCardSubscription(sub));
  const anchor = moving ? lemonRenewalAnchor(sub?.current_period_end) : null;
  return { moving, firstChargeDate: anchor ? new Date(anchor * 1000).toISOString() : null };
}

/**
 * The card checkout link an admin sends a customer. Always Stripe: it is the only way a
 * new payment can start, and this never falls back to Lemon Squeezy. The customer enters
 * their own card. Throws a readable message, and logs it, when Stripe is not configured
 * or the plan has no Stripe price.
 */
export async function createAdminCheckoutUrl(input: AdminCheckoutInput): Promise<string> {
  if (!stripeConfigured()) {
    console.error(`[billing/admin-checkout] refused ${input.plan} checkout: Stripe is not configured`);
    throw new Error("Card checkout is not available: Stripe is not configured.");
  }
  const { moving } = describeMove(input.subscription, input.plan);
  // A subscriber with a continuous active plan keeps their old price. Never fall
  // back to the current price for one: they would be charged more than agreed.
  const tier = moving && keepsLegacyPrice(input.subscription, input.plan) ? "legacy" : "current";
  const priceId = stripePriceId(input.plan, tier);
  if (!priceId) {
    console.error(`[billing/admin-checkout] refused ${input.plan} checkout: no Stripe ${tier} price is configured`);
    throw new Error(`No Stripe ${tier} price is configured for ${input.plan}.`);
  }
  const lsId = moving ? input.subscription?.ls_subscription_id ?? null : null;
  return createStripeCheckoutUrl({
    priceId,
    profileId: input.profileId,
    planType: input.plan,
    email: input.email,
    customerId: input.subscription?.stripe_customer_id ?? null,
    successUrl: moving ? `${origin()}/billing?checkout=success` : input.successUrl,
    cancelUrl: moving ? `${origin()}/billing` : input.successUrl,
    managedPayments: managedPaymentsFor(input.plan),
    replacesLsSubscriptionId: lsId,
    billingCycleAnchor: lsId ? lemonRenewalAnchor(input.subscription?.current_period_end) : null,
  });
}
