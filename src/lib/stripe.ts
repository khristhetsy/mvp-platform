import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = new (Stripe as any)(key) as Stripe;

/** Map plan_type → Stripe price ID */
export const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  founder_basic: process.env.STRIPE_PRICE_CAPITALOS_FOUNDER_PRO,
  founder_professional: process.env.STRIPE_PRICE_CAPITALOS_FOUNDER_PREMIUM,
  investor_pro: process.env.STRIPE_PRICE_CAPITALOS_INVESTOR_PRO,
  investor_premium: process.env.STRIPE_PRICE_CAPITALOS_INVESTOR_PREMIUM,
};
