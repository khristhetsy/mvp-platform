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
  | "internal"
  /** New founder, signed up but checkout not finished. No paid entitlements. */
  | "pending_payment";

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
  // Whether an account is genuinely grandfathered lives on the row, not in the
  // label — use planLabelFor() so the two can never disagree.
  founder_free: "Free",
  founder_trial: "Free (legacy)",
  founder_basic: "Basic",
  founder_professional: "Professional",
  founder_managed_ir: "SPV Program",
  investor_free: "Investor Free",
  investor_pro: "Investor Pro",
  investor_premium: "Investor Premium",
  admin_internal: "Admin Internal",
};

export const PLAN_PRICES: Record<PlanType, number> = {
  founder_free: 0,
  founder_trial: 0,
  founder_basic: 4900,
  founder_professional: 19900,
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

// Free is NOT here. It was discontinued for new signups when Basic launched at
// $49 (16 Sep 2026); existing accounts keep it via subscriptions.is_grandfathered.
// Re-adding it here would auto-grant free accounts again — see isAutoGrantSignupPlan.
export const SIGNUP_FOUNDER_PLANS: SignupPlanOption[] = [
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$49",
    priceSubtext: "/month",
    paidPlan: true,
    features: [
      "Everything in Free",
      "Up to 5 matched investors receive your one-pager",
      "Attend the Investor Conference Virtual Event",
      "DIY outreach unlocked — you can now reach investors",
      "Fully self-serve",
    ],
  },
  {
    planType: "founder_professional",
    title: "Professional",
    priceLabel: "$199",
    priceSubtext: "/month",
    badge: "Most popular",
    paidPlan: true,
    features: [
      "Everything in Basic",
      "Up to 50 investors",
      "Monthly live presentation slot",
      "Investors intro requests",
      "Self-serve, with a call available",
    ],
  },
  {
    planType: "founder_managed_ir",
    title: "SPV Program",
    priceLabel: "Pricing on request",
    priceSubtext: "3-month minimum",
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
  // founder_free deliberately absent — a crafted ?plan=founder_free must not
  // re-open the discontinued tier.
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

  // Founders have no free tier to auto-grant — every founder plan goes through
  // checkout. This returning true for founder_free is what let new signups skip
  // payment entirely.
  return false;
}

/**
 * Plan label for one account.
 *
 * The plan type alone can't say whether free access is legitimate: the label
 * used to read "Free (grandfathered)" for every free row, including accounts
 * created after the tier was discontinued. This reads the stored flag instead.
 */
export function planLabelFor(planType: PlanType, isGrandfathered = false): string {
  if (planType === "founder_free") {
    return isGrandfathered ? "Free (grandfathered)" : "Free — discontinued tier";
  }
  return PLAN_LABELS[planType];
}
