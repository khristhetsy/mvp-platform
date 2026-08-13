export type PlanType =
  | "founder_free"
  | "founder_trial"
  | "founder_basic"
  | "founder_professional"
  | "founder_managed_ir"
  | "investor_free"
  | "investor_pro"
  | "investor_premium"
  | "admin_internal";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "expired"
  | "canceled"
  | "free"
  | "internal";

export type FeatureKey =
  | "dashboard"
  | "ai_diligence"
  | "documents"
  | "readiness"
  | "investor_access"
  | "capital_raise"
  | "elearning"
  | "analytics"
  | "premium_tools"
  | "investor_workspace"
  | "settings";

export type SubscriptionRecord = {
  id: string;
  profile_id: string;
  role: string;
  plan_type: PlanType;
  subscription_status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_price_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  // When a past_due subscription loses access. Set by the billing webhook;
  // null for healthy subscriptions.
  grace_period_ends_at: string | null;
  // LemonSqueezy
  ls_customer_id:     string | null;
  ls_subscription_id: string | null;
  ls_variant_id:      string | null;
  // Stripe (legacy, kept for audit)
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;
  stripe_price_id:        string | null;
};

export const PLAN_LABELS: Record<PlanType, string> = {
  founder_free: "Free",
  founder_trial: "Free Trial",
  founder_basic: "Basic",
  founder_professional: "Professional",
  founder_managed_ir: "Managed IR",
  investor_free: "Investor Free",
  investor_pro: "Investor Pro",
  investor_premium: "Investor Premium",
  admin_internal: "Admin Internal",
};

export const PLAN_PRICES: Record<PlanType, number> = {
  founder_free: 0,
  founder_trial: 0,
  founder_basic: 49900,
  founder_professional: 100000,
  founder_managed_ir: 350000,
  investor_free: 0,
  investor_pro: 50000,
  investor_premium: 100000,
  admin_internal: 0,
};

/** Additional company accounts (Professional only). */
export const ADDITIONAL_COMPANY_PRICE = 80000;
/** Managed IR contract minimum. */
export const MANAGED_IR_MIN_MONTHS = 3;

export const FOUNDER_BASIC_FEATURES: FeatureKey[] = [
  "dashboard",
  "ai_diligence",
  "documents",
  "readiness",
  "settings",
];

export const FOUNDER_PROFESSIONAL_FEATURES: FeatureKey[] = [
  ...FOUNDER_BASIC_FEATURES,
  "investor_access",
  "capital_raise",
  "elearning",
  "analytics",
  "premium_tools",
];

export const TRIAL_DURATION_DAYS = 3;

export type SignupPlanOption = {
  planType: PlanType;
  title: string;
  priceLabel: string;
  priceSubtext?: string;
  badge?: string;
  features: string[];
  paidPlan?: boolean;
  /** Sales-led tier — shown with a "Talk to us" CTA instead of self-serve checkout. */
  contactSales?: boolean;
};

export const SIGNUP_FOUNDER_PLANS: SignupPlanOption[] = [
  {
    planType: "founder_free",
    title: "Free",
    priceLabel: "$0",
    priceSubtext: "Readiness",
    badge: "Start here",
    features: [
      "All tools: CRR, valuation, data room, e-learning",
      "See that matches exist — count, sector, fit tier",
      "Investor identities hidden · no distribution",
      "Your qualification layer, prescored for you",
    ],
  },
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$499",
    priceSubtext: "/month",
    paidPlan: true,
    features: [
      "Everything in Free",
      "Up to 25 matched investors receive your one-pager",
      "Event spotlight",
      "DIY outreach unlocked — you can now reach investors",
      "Fully self-serve",
    ],
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$1,000",
    priceSubtext: "/month",
    badge: "Most popular",
    paidPlan: true,
    features: [
      "Everything in Basic",
      "Up to 100 investors",
      "Monthly presentation slot",
      "Brokered intro requests",
      "Additional company accounts $800/mo",
      "Self-serve, with a call available",
    ],
  },
  {
    planType: "founder_managed_ir",
    title: "Managed IR",
    priceLabel: "$3,500",
    priceSubtext: "/month · 3-month minimum",
    contactSales: true,
    features: [
      "Done-for-you investor relations",
      "We curate the list and materials",
      "You review and approve",
      "Post-conference follow-up run for you",
      "Capacity-capped — talk to us",
    ],
  },
];

export const SIGNUP_INVESTOR_PLAN: SignupPlanOption = {
  planType: "investor_free",
  title: "Investor Account",
  priceLabel: "Free",
  features: [
    "Full investor dashboard",
    "Watchlist",
    "Interest pipeline",
    "SPVs",
    "Portfolio",
    "Messages",
    "Analytics",
  ],
};

const SIGNUP_PLAN_TYPES = new Set<PlanType>([
  "founder_free",
  "founder_basic",
  "founder_professional",
  "investor_free",
]);

export function parseRequestedPlan(value: unknown): PlanType | null {
  if (typeof value !== "string") {
    return null;
  }

  if (SIGNUP_PLAN_TYPES.has(value as PlanType)) {
    return value as PlanType;
  }

  return null;
}

export function isAutoGrantSignupPlan(role: "founder" | "investor", planType: PlanType) {
  if (role === "investor") {
    return planType === "investor_free";
  }

  return planType === "founder_free";
}
