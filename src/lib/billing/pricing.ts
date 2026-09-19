import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";
import { FOUNDER_PROFESSIONAL_FEATURES, PLAN_PRICES } from "@/lib/subscriptions/plans";
import {
  addCompanyLabel, centsFor, isPriced, priceLabel, priceSublabel, type PricingCatalog,
} from "@/lib/subscriptions/pricing-catalog";

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
    planType: "founder_free",
    title: "Free",
    priceLabel: "$0",
    priceSubtext: "Readiness",
    monthlyPriceCents: PLAN_PRICES.founder_free,
    badge: "Start here",
    features: [
      "All tools: CRR, valuation, data room, e-learning",
      "See that matches exist — count, sector, fit tier",
      "Investor identities hidden · no distribution",
      "Your qualification layer, prescored for you",
    ],
    paidPlan: false,
  },
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$49",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_basic,
    features: [
      "Everything in Free",
      "Up to 5 matched investors get your one-pager",
      "Attend the Investor Conference Virtual Event",
      "DIY outreach unlocked — you can now reach investors",
      "Fully self-serve",
    ],
    paidPlan: true,
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$199",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_professional,
    badge: "Most popular",
    recommended: true,
    features: [
      "Everything in Basic",
      "Up to 50 investors",
      "Monthly live presentation slot",
      "Investors intro requests",
      "Self-serve, with a call available",
    ],
    paidPlan: true,
  },
  {
    planType: "founder_managed_ir",
    title: "SPV Program",
    priceLabel: "Pricing on request",
    priceSubtext: "3-month min",
    monthlyPriceCents: PLAN_PRICES.founder_managed_ir,
    contactSales: true,
    features: [
      "Done-for-you investor relations",
      "We curate the list and materials",
      "You review and approve",
      "Post-conference follow-up run for you",
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
  { label: "Additional company accounts ($800/mo)", free: false, basic: false, professional: true },
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

// ─── Live pricing overlay ────────────────────────────────────────────────────
// The arrays above are the copy (titles, features, badges) and the fallback
// prices. These functions lay the ACTIVE catalogue over them, so a price change
// in the admin reaches every card without anyone retyping a label.

export function founderPricingPlans(catalog: PricingCatalog): PricingPlanCard[] {
  return FOUNDER_PRICING_PLANS.map((card) =>
    isPriced(card.planType)
      ? {
          ...card,
          priceLabel: priceLabel(catalog, card.planType),
          priceSubtext: priceSublabel(catalog, card.planType),
          monthlyPriceCents: centsFor(catalog, card.planType),
        }
      : card,
  );
}

export function featureComparison(catalog: PricingCatalog): FeatureComparisonRow[] {
  return FEATURE_COMPARISON.map((row) =>
    row.label.startsWith("Additional company accounts")
      ? { ...row, label: `Additional company accounts (${addCompanyLabel(catalog)})` }
      : row,
  );
}
