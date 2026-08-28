import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";
import { FOUNDER_PROFESSIONAL_FEATURES, PLAN_PRICES } from "@/lib/subscriptions/plans";

/** LemonSqueezy variant IDs — set in env. */
export const LS_VARIANT_IDS = {
  founder_basic:        process.env.LEMONSQUEEZY_VARIANT_ID_BASIC        ?? "",
  founder_professional: process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL ?? "",
} as const;

export type PricingPlanCard = {
  planType: PlanType;
  title: string;
  priceLabel: string;
  priceSubtext?: string;
  monthlyPriceCents: number;
  badge?: string;
  recommended?: boolean;
  features: string[];
  paidPlan: boolean;
  /** Sales-led tier — shown with a "Talk to us" CTA instead of self-serve checkout. */
  contactSales?: boolean;
};

export const FOUNDER_PRICING_PLANS: PricingPlanCard[] = [
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$499",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_basic,
    features: [
      "Up to 25 matched investors get your one-pager",
      "Event spotlight",
      "DIY outreach — you reach investors directly",
      "All tools included: CRR, valuation, data room, e-learning, AI DD",
      "Fully self-serve",
    ],
    paidPlan: true,
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$1,000",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_professional,
    badge: "Most founders start here",
    recommended: true,
    features: [
      "Up to 100 matched investors",
      "Monthly presentation slot",
      "Brokered intro requests",
      "All tools included",
      "Self-serve, with a call available",
    ],
    paidPlan: true,
  },
  {
    planType: "founder_managed_ir",
    title: "Managed IR",
    priceLabel: "$3,500",
    priceSubtext: "/month · 3-month min",
    monthlyPriceCents: PLAN_PRICES.founder_managed_ir,
    contactSales: true,
    features: [
      "Done-for-you investor relations",
      "We curate the list and materials",
      "You review and approve",
      "Post-event follow-up run for you",
      "Capacity-capped — talk to us",
    ],
    paidPlan: true,
  },
];

export const INVESTOR_PRICING_PLAN: PricingPlanCard = {
  planType: "investor_free",
  title: "Investor Account",
  priceLabel: "Free",
  monthlyPriceCents: 0,
  features: [
    "Full investor dashboard",
    "Watchlist & interest pipeline",
    "SPVs & portfolio",
    "Messages & analytics",
    "Always free",
  ],
  paidPlan: false,
};

export type FeatureComparisonRow = {
  label: string;
  free: boolean;
  basic: boolean;
  professional: boolean;
};

// New model: all TOOLS are free; paid tiers add DISTRIBUTION.
export const FEATURE_COMPARISON: FeatureComparisonRow[] = [
  { label: "CRR / readiness", free: true, basic: true, professional: true },
  { label: "Valuation studio", free: true, basic: true, professional: true },
  { label: "Data room & documents", free: true, basic: true, professional: true },
  { label: "e-Learning", free: true, basic: true, professional: true },
  { label: "See matches exist (count · sector · fit tier)", free: true, basic: true, professional: true },
  { label: "Investor identities revealed", free: false, basic: true, professional: true },
  { label: "One-pager distributed to matches", free: false, basic: true, professional: true },
  { label: "Event spotlight", free: false, basic: true, professional: true },
  { label: "DIY outreach", free: false, basic: true, professional: true },
  { label: "Matched investor cap", free: false, basic: true, professional: true },
  { label: "Monthly presentation slot", free: false, basic: false, professional: true },
  { label: "Brokered intro requests", free: false, basic: false, professional: true },
];

export function formatMonthlyPrice(cents: number) {
  if (cents === 0) {
    return "$0";
  }

  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function planIncludesFeature(planType: PlanType, featureKey: FeatureKey) {
  // New model: every founder tier gets all tools; distribution is gated separately.
  if (
    planType === "founder_free" ||
    planType === "founder_basic" ||
    planType === "founder_professional" ||
    planType === "founder_managed_ir" ||
    planType === "founder_trial" ||
    planType === "admin_internal"
  ) {
    return FOUNDER_PROFESSIONAL_FEATURES.includes(featureKey);
  }

  return featureKey === "investor_workspace" || featureKey === "settings";
}
