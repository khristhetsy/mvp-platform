import { stripePriceId, type StripePlan } from "@/lib/billing/stripe-mapping";

type Env = Record<string, string | undefined>;

/**
 * A plan can be bought by card: Stripe is configured and the plan has a current Stripe
 * price. Stripe is the only way a new card payment can start. Lemon Squeezy still bills
 * the subscriptions it already has, but it never takes a new one.
 *
 * Reads the env directly: lib/stripe.ts is server only, and this file is reached from
 * shared code. The Stripe key is a server variable, so in a browser this is always false.
 */
export function cardCheckoutReady(plan: StripePlan, env: Env = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim()) && stripePriceId(plan, "current", env) !== null;
}

/** Returns true when card checkout is wired: Stripe is configured and Basic or Professional has a Stripe price. */
export function isPaymentsEnabled(env: Env = process.env): boolean {
  return cardCheckoutReady("founder_basic", env) || cardCheckoutReady("founder_professional", env);
}

/**
 * Premium can be bought. Always true since Oct 9, 2026: Premium is paid by
 * bank wire (src/lib/billing/wire.ts), which needs no card checkout, so
 * it is listed on every founder and public plan list. Kept for the callers
 * (support assistant, assistant knowledge) that still ask.
 */
export function premiumCheckoutReady(): boolean {
  return true;
}
