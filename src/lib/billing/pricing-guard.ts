/** Returns true when LemonSqueezy checkout is wired. */
export function isPaymentsEnabled() {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
    process.env.LEMONSQUEEZY_STORE_ID &&
    process.env.LEMONSQUEEZY_VARIANT_ID_BASIC &&
    process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL
  );
}
