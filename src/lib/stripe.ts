/**
 * Stripe is replaced by LemonSqueezy. This stub keeps any remaining
 * Stripe imports compiling. Do not add new Stripe usage.
 */

export const BILLING_ENABLED = Boolean(process.env.LEMONSQUEEZY_API_KEY);

// Stub — not used
export const stripe = null as unknown as import("stripe").default;

export const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  founder_basic:        process.env.LEMONSQUEEZY_VARIANT_ID_BASIC,
  founder_professional: process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL,
  investor_pro:         undefined,
  investor_premium:     undefined,
};
