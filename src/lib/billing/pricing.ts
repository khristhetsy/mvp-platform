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

// Founder Free was discontinued for new sign ups on 16 Sep 2026; existing free
// accounts are grandfathered and are not shown a Free card.
export const FOUNDER_PRICING_PLANS: PricingPlanCard[] = [
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$49",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_basic,
    features: [
      "All tools: CRR, valuation, data room, e-learning",
      "Up to 5 matched investors get your one-pager",
      "Attend the Investor Conference Virtual Event",
      "DIY outreach unlocked — you can now reach investors",
      "Up to 5 intro requests a month, through iCFO",
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
      "Up to 20 intro requests a month",
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
  basic: boolean;
  professional: boolean;
};

// Every plan includes all tools; Professional adds presentation slots and brokered intros.
export const FEATURE_COMPARISON: FeatureComparisonRow[] = [
  { label: "CRR / readiness", basic: true, professional: true },
  { label: "Valuation studio", basic: true, professional: true },
  { label: "Data room & documents", basic: true, professional: true },
  { label: "e-Learning", basic: true, professional: true },
  { label: "See matches exist (count · sector · fit tier)", basic: true, professional: true },
  { label: "Investor identities revealed", basic: true, professional: true },
  { label: "One-pager distributed to matches", basic: true, professional: true },
  { label: "Event spotlight", basic: true, professional: true },
  { label: "DIY outreach", basic: true, professional: true },
  { label: "Matched investor cap", basic: true, professional: true },
  { label: "Monthly presentation slot", basic: false, professional: true },
  { label: "Intro requests through iCFO (5 or 20 a month)", basic: true, professional: true },
  { label: "Additional company accounts ($800/mo)", basic: false, professional: true },
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
