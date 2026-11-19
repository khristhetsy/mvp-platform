import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";
import { managedPaymentsFor, stripePriceId } from "@/lib/billing/stripe-mapping";

export type AdminCheckoutInput = {
  plan: "founder_basic" | "founder_professional";
  email: string;
  profileId: string;
  successUrl: string;
  name?: string;
  /** Lemon Squeezy variant, used only when Stripe is not configured. */
  variantId?: string;
};

/**
 * The card checkout link an admin sends a customer. Stripe once it is configured
 * (the current price), Lemon Squeezy otherwise. The customer enters their own card.
 * Throws a readable message when the plan has no price or variant set.
 */
export async function createAdminCheckoutUrl(input: AdminCheckoutInput): Promise<string> {
  if (stripeConfigured()) {
    const priceId = stripePriceId(input.plan, "current");
    if (!priceId) throw new Error(`No Stripe price is configured for ${input.plan}.`);
    return createStripeCheckoutUrl({
      priceId,
      profileId: input.profileId,
      planType: input.plan,
      email: input.email,
      customerId: null,
      successUrl: input.successUrl,
      cancelUrl: input.successUrl,
      managedPayments: managedPaymentsFor(input.plan),
      replacesLsSubscriptionId: null,
    });
  }
  if (!input.variantId) throw new Error(`No Lemon Squeezy variant is configured for ${input.plan}.`);
  return createCheckoutUrl({ variantId: input.variantId, email: input.email, profileId: input.profileId, successUrl: input.successUrl, name: input.name });
}
