import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";
import { FOUNDER_PROFESSIONAL_FEATURES, PLAN_PRICES } from "@/lib/subscriptions/plans";
import { pricing as websitePricing } from "@/content/pricing";
import {
  addCompanyLabel, centsFor, isPriced, priceLabel, priceSublabel, type PricingCatalog,
} from "@/lib/subscriptions/pricing-catalog";

/** LemonSqueezy variant IDs — set in env. */
export const LS_VARIANT_IDS = {
  founder_basic:        process.env.LEMONSQUEEZY_VARIANT_ID_BASIC        ?? "",
  founder_professional: process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL ?? "",
  founder_premium:      process.env.LEMONSQUEEZY_VARIANT_ID_PREMIUM      ?? "",
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
  /** One line under the price. Same words as the website pricing page. */
  desc?: string;
  /** Top tag on the card (the website's "Most founders start here"). */
  tag?: string;
  /** Free plan promotion: tag, price note and the urgency strip. */
  promo?: { tag: string; priceNote: string; note: string };
};

// Free is shown again (Oct 9, 2026): a one time AI due diligence report, the
// CRR, sharing with any investor and a Private Market listing. Premium is paid
// by bank wire only; Basic and Professional check out through Lemon Squeezy.
const WEBSITE_TIER_BY_PLAN: Partial<Record<PlanType, string>> = {
  founder_free: "Free",
  founder_basic: "Basic",
  founder_professional: "Professional",
  founder_premium: "Premium",
  founder_managed_ir: "SPV Program",
};

/**
 * Card copy comes from the website pricing content (src/content/pricing.ts), so
 * /upgrade and /pricing read the same words and cannot drift. Prices still come
 * from the live catalogue in founderPricingPlans below.
 */
function websiteCopy(planType: PlanType) {
  const tier = websitePricing.tiers.find((t) => t.name === WEBSITE_TIER_BY_PLAN[planType]);
  if (!tier) throw new Error(`No website pricing tier for ${planType}`);
  const features = "features" in tier && tier.features ? [...tier.features] : "advisory" in tier && tier.advisory ? [tier.advisory.body] : [];
  return {
    desc: tier.desc,
    badge: "badge" in tier ? tier.badge : undefined,
    promo: "promo" in tier && tier.promo ? { ...tier.promo } : undefined,
    tag: tier.featured ? "Most founders start here" : undefined,
    features,
  };
}

// Free is shown again (Oct 9, 2026): a one time AI due diligence report, the
// CRR, sharing with any investor and a Private Market listing. Premium is paid
// by bank wire only; Basic and Professional check out through Lemon Squeezy.
export const FOUNDER_PRICING_PLANS: PricingPlanCard[] = [
  {
    planType: "founder_free",
    title: "Free",
    priceLabel: "$0",
    priceSubtext: "",
    monthlyPriceCents: PLAN_PRICES.founder_free,
    ...websiteCopy("founder_free"),
    paidPlan: false,
  },
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$49",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_basic,
    ...websiteCopy("founder_basic"),
    paidPlan: true,
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$199",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_professional,
    recommended: true,
    ...websiteCopy("founder_professional"),
    paidPlan: true,
  },
  {
    planType: "founder_premium",
    title: "Premium",
    priceLabel: "$1,000",
    priceSubtext: "/month",
    monthlyPriceCents: PLAN_PRICES.founder_premium,
    ...websiteCopy("founder_premium"),
    paidPlan: true,
  },
  {
    planType: "founder_managed_ir",
    title: "SPV Program",
    priceLabel: "Pricing on request",
    priceSubtext: "3-month min",
    monthlyPriceCents: PLAN_PRICES.founder_managed_ir,
    contactSales: true,
    ...websiteCopy("founder_managed_ir"),
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
    planType === "founder_premium" ||
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
          // Free keeps its own (empty) sub line; the catalogue's "Readiness" is an admin label.
          priceSubtext: card.planType === "founder_free" ? card.priceSubtext : priceSublabel(catalog, card.planType),
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
