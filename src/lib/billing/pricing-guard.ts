import { hasAnyBuyLink } from "@/lib/billing/buy-links";

/** Returns true when LemonSqueezy checkout is wired (buy links OR API). */
export function isPaymentsEnabled() {
  const buyLinks = hasAnyBuyLink();
  const apiBased = Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
    process.env.LEMONSQUEEZY_VARIANT_ID_BASIC &&
    process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL
  );
  return buyLinks || apiBased;
}
