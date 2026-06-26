import type { PlanType } from "@/lib/subscriptions/plans";

/**
 * Public Lemon Squeezy "Buy" links (from the dashboard Share button).
 *
 * These are public URLs — no API key, store id, or variant lookup — so they can
 * never throw the test/live mode-mismatch 404 the API path produced. They're safe
 * to commit (they contain no secret). An env var, if set, overrides the default.
 *
 * Base URL only — the checkout route appends ?checkout[email] and
 * ?checkout[custom][profile_id] so the webhook can map the order to a profile.
 */
const DEFAULTS: Partial<Record<PlanType, string>> = {
  // Live-mode buy links (Share button, Test mode OFF).
  founder_basic: "https://capitalos.lemonsqueezy.com/checkout/buy/cb9549ed-db43-4b53-8f40-43584b3397f0",
  founder_professional: "https://capitalos.lemonsqueezy.com/checkout/buy/e105f3d0-5c41-48ec-8616-d7ddc9608f9c",
};

export const BUY_LINKS: Partial<Record<PlanType, string>> = {
  founder_basic: process.env.LEMONSQUEEZY_CHECKOUT_URL_BASIC || DEFAULTS.founder_basic,
  founder_professional: process.env.LEMONSQUEEZY_CHECKOUT_URL_PROFESSIONAL || DEFAULTS.founder_professional,
};

/** A specific plan has a usable buy link. */
export function hasBuyLink(planType: PlanType): boolean {
  return Boolean(BUY_LINKS[planType]);
}

/** At least one founder plan has a usable buy link (used to enable checkout). */
export function hasAnyBuyLink(): boolean {
  return hasBuyLink("founder_basic") || hasBuyLink("founder_professional");
}
