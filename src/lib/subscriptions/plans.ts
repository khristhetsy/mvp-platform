export type PlanType =
  | "founder_free"
  | "founder_trial"
  | "founder_basic"
  | "founder_professional"
  | "founder_premium"
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
  // True = this free founder keeps the full tool set after the free tier was
  // discontinued. Set by the 20260921001 backfill and granted/revoked by staff in
  // admin billing (updateBillingCustomer). The ONLY grandfather flag access reads.
  // Optional so fixtures without it fail open; only an explicit false paywalls.
  is_grandfathered?: boolean | null;
  // LemonSqueezy
  ls_customer_id:     string | null;
  ls_subscription_id: string | null;
  ls_variant_id:      string | null;
  // Stripe columns: unused since the move to Lemon Squeezy; kept only because
  // the database still has them. Nothing reads or writes them.
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
  founder_premium: "Premium",
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
  founder_premium: 100000,
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

/**
 * Free founders (not grandfathered): the dashboard, documents (to feed the
 * report), the AI due diligence report and the CRR. Everything else is an
 * upgrade.
 */
export const FOUNDER_FREE_FEATURES: FeatureKey[] = [
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

/**
 * Premium: done for you. Distribution limits match Professional (see
 * founderEntitlements); what Premium adds is the iCFO team running the outreach.
 */
export const PREMIUM_TAGLINE = "Your raise, run by our team.";
export const PREMIUM_FEATURES: string[] = [
  "Everything in Professional",
  "An iCFO team member manages your investor outreach",
  "We find your best fits in our 7,000+ investor network",
  "We make the introductions and follow up",
  "You take the meetings and close",
  "Up to 20,000 public directory investors as the directory grows",
  "40,000 Manual outreach emails a month",
];

/**
 * Free (approved Oct 8, 2026): a one time AI due diligence report and the
 * Capital Readiness Rating with its improvement plan, plus a Private Market
 * listing once the listing checklist is complete. No other tools and no
 * investor outreach: founders upgrade for those. New Free rows are written with
 * is_grandfathered = false, which access.ts reads to grant only
 * FOUNDER_FREE_FEATURES; the 11 grandfathered accounts keep every tool.
 */
export const FREE_FEATURES: string[] = [
  "Full AI due diligence report",
  "Capital Readiness Rating with steps to raise it",
  "Share your report with any investor",
  "Listed in our Private Market for 7,000+ investors once complete",
];

export const SIGNUP_FOUNDER_PLANS: SignupPlanOption[] = [
  {
    planType: "founder_free",
    title: "Free",
    priceLabel: "$0",
    priceSubtext: "No credit card",
    features: FREE_FEATURES,
  },
  {
    planType: "founder_basic",
    title: "Basic",
    priceLabel: "$49",
    priceSubtext: "/month",
    paidPlan: true,
    features: [
      "All tools: CRR, valuation, data room, e-learning",
      "Up to 5 matched investors receive your one-pager",
      "Attend the Investor Conference Virtual Event",
      "DIY outreach unlocked — you can now reach investors",
      "Up to 5 intro requests a month, through iCFO",
      "500 investors from the public investor directory, not the iCFO Capital investor network",
      "1,000 Manual outreach emails a month",
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
      "Up to 20 intro requests a month",
      "Up to 10,000 public directory investors as the directory grows, not the iCFO Capital investor network",
      "20,000 Manual outreach emails a month",
      "Self-serve, with a call available",
    ],
  },
  {
    planType: "founder_premium",
    title: "Premium",
    priceLabel: "$1,000",
    priceSubtext: "/month",
    paidPlan: true,
    features: PREMIUM_FEATURES,
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
  // Free is back for due diligence only (Oct 8, 2026). It grants
  // FOUNDER_FREE_FEATURES, never the full toolset, because new Free rows are
  // written with is_grandfathered = false.
  "founder_free",
  "founder_basic",
  "founder_professional",
  "founder_premium",
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

  // Free (due diligence only) needs no checkout. Paid founder plans always go
  // through checkout, so they are never auto-granted.
  return planType === "founder_free";
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
    return isGrandfathered ? "Free (grandfathered)" : "Free";
  }
  return PLAN_LABELS[planType];
}
