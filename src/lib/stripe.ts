/**
 * Stripe is not active — billing is handled manually.
 * This stub keeps imports across the codebase compiling without a live key.
 * Replace with real Stripe integration when ready to charge.
 */

export const BILLING_ENABLED = false;

// Stub so existing imports don't break
export const stripe = null as unknown as import("stripe").default;

export const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  founder_basic:        undefined,
  founder_professional: undefined,
  investor_pro:         undefined,
  investor_premium:     undefined,
};
