export type PlanType =
  | "founder_trial"
  | "founder_basic"
  | "founder_professional"
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
};

export const PLAN_LABELS: Record<PlanType, string> = {
  founder_trial: "Free Trial",
  founder_basic: "Founder Pro",
  founder_professional: "Founder Premium",
  investor_free: "Investor Free",
  investor_pro: "Investor Pro",
  investor_premium: "Investor Premium",
  admin_internal: "Admin Internal",
};

export const PLAN_PRICES: Record<PlanType, number> = {
  founder_trial: 0,
  founder_basic: 50000,
  founder_professional: 100000,
  investor_free: 0,
  investor_pro: 50000,
  investor_premium: 100000,
  admin_internal: 0,
};

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
};

export const SIGNUP_FOUNDER_PLANS: SignupPlanOption[] = [
  {
    planType: "founder_trial",
    title: "Free Trial",
    priceLabel: "$0",
    priceSubtext: "3-day trial",
    badge: "Recommended",
    features: [
      "Full Professional access for 3 days",
      "No credit card required",
      "Upgrade anytime",
    ],
  },
  {
    planType: "founder_basic",
    title: "Founder Basic",
    priceLabel: "$499",
    priceSubtext: "/month",
    paidPlan: true,
    features: [
      "Dashboard & core tools",
      "AI Due Diligence",
      "Documents & readiness",
      "No investor access",
      "No eLearning",
      "No premium analytics",
    ],
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$1,000",
    priceSubtext: "/month",
    paidPlan: true,
    features: [
      "Everything in Basic",
      "Investor access",
      "Capital raise tools",
      "eLearning",
      "Advanced analytics",
      "Premium features",
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
  "founder_trial",
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

  return planType === "founder_trial";
}
