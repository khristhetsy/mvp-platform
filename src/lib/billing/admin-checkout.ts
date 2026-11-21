import { createCheckoutUrl } from "@/lib/lemonsqueezy";
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
  /** Lemon Squeezy variant, used only when Stripe is not configured. */
  variantId?: string;
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
 * The card checkout link an admin sends a customer. Stripe once it is configured
 * (the current price), Lemon Squeezy otherwise. The customer enters their own card.
 * Throws a readable message when the plan has no price or variant set.
 */
export async function createAdminCheckoutUrl(input: AdminCheckoutInput): Promise<string> {
  if (stripeConfigured()) {
    const { moving } = describeMove(input.subscription, input.plan);
    // A subscriber with a continuous active plan keeps their old price. Never fall
    // back to the current price for one: they would be charged more than agreed.
    const tier = moving && keepsLegacyPrice(input.subscription, input.plan) ? "legacy" : "current";
    const priceId = stripePriceId(input.plan, tier);
    if (!priceId) throw new Error(`No Stripe ${tier} price is configured for ${input.plan}.`);
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
  if (!input.variantId) throw new Error(`No Lemon Squeezy variant is configured for ${input.plan}.`);
  return createCheckoutUrl({ variantId: input.variantId, email: input.email, profileId: input.profileId, successUrl: input.successUrl, name: input.name });
}
