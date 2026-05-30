/** Returns true only when Stripe checkout is wired. Always false in this phase. */
export function isPaymentsEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
