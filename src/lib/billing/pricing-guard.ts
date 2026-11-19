import { hasAnyBuyLink } from "@/lib/billing/buy-links";

/** Returns true when card checkout is wired: Stripe, or Lemon Squeezy (buy links OR API). */
export function isPaymentsEnabled() {
  // Read the env directly: this file is imported from client code, and lib/stripe.ts is server only.
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const buyLinks = hasAnyBuyLink();
  const apiBased = Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
    process.env.LEMONSQUEEZY_VARIANT_ID_BASIC &&
    process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL
  );
  return stripe || buyLinks || apiBased;
}
