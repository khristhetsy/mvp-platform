import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";
import { FOUNDER_BASIC_FEATURES, FOUNDER_PROFESSIONAL_FEATURES, PLAN_PRICES } from "@/lib/subscriptions/plans";

/** Placeholder Stripe price IDs — wire when payment integration ships. */
export const STRIPE_PRICE_IDS = {
  founder_basic: process.env.STRIPE_PRICE_ID_BASIC ?? "price_placeholder_founder_basic",
  founder_professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL ?? "price_placeholder_founder_professional",
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
};

export const FOUNDER_PRICING_PLANS: PricingPlanCard[] = [
  {
    planType: "founder_trial",
    title: "Free Trial",
    priceLabel: "$0",
    priceSubtext: "3-day trial",
    monthlyPriceCents: PLAN_PRICES.founder_trial,
    features: [
      "Full Professional access for 3 days",
      "No credit card required",
      "AI Due Diligence & documents",
      "Upgrade anytime",
    ],
    paidPlan: false,
  },
  {
    planType: "founder_basic",
    title: "Founder Basic",
    priceLabel: "$499",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_basic,
    features: [
      "Dashboard & core founder tools",
      "AI Due Diligence",
      "Documents & readiness",
      "No investor CRM access",
      "No eLearning or premium analytics",
    ],
    paidPlan: true,
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$1,000",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_professional,
    badge: "Recommended",
    recommended: true,
    features: [
      "Everything in Basic",
      "Investor access & CRM",
      "Capital raise tools",
      "eLearning",
      "Advanced analytics",
      "Premium founder features",
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
  featureKey: FeatureKey;
  label: string;
  trial: boolean;
  basic: boolean;
  professional: boolean;
};

export const FEATURE_COMPARISON: FeatureComparisonRow[] = [
  { featureKey: "dashboard", label: "Founder dashboard", trial: true, basic: true, professional: true },
  { featureKey: "ai_diligence", label: "AI Due Diligence", trial: true, basic: true, professional: true },
  { featureKey: "documents", label: "Document room", trial: true, basic: true, professional: true },
  { featureKey: "readiness", label: "Readiness tracking", trial: true, basic: true, professional: true },
  { featureKey: "investor_access", label: "Investor CRM", trial: true, basic: false, professional: true },
  { featureKey: "capital_raise", label: "Capital raise tools", trial: true, basic: false, professional: true },
  { featureKey: "elearning", label: "eLearning", trial: true, basic: false, professional: true },
  { featureKey: "analytics", label: "Advanced analytics", trial: true, basic: false, professional: true },
  { featureKey: "premium_tools", label: "Premium tools", trial: true, basic: false, professional: true },
];

export function formatMonthlyPrice(cents: number) {
  if (cents === 0) {
    return "$0";
  }

  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function planIncludesFeature(planType: PlanType, featureKey: FeatureKey, trialActive = true) {
  if (planType === "founder_professional" || planType === "admin_internal") {
    return FOUNDER_PROFESSIONAL_FEATURES.includes(featureKey);
  }

  if (planType === "founder_basic") {
    return FOUNDER_BASIC_FEATURES.includes(featureKey);
  }

  if (planType === "founder_trial") {
    return trialActive
      ? FOUNDER_PROFESSIONAL_FEATURES.includes(featureKey)
      : FOUNDER_BASIC_FEATURES.includes(featureKey);
  }

  return featureKey === "investor_workspace" || featureKey === "settings";
}
