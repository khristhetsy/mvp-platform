import {
  FOUNDER_BASIC_FEATURES,
  FOUNDER_PROFESSIONAL_FEATURES,
  type FeatureKey,
  type PlanType,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from "@/lib/subscriptions/plans";

export type FeatureAccessResult = {
  allowed: boolean;
  reason: string | null;
};

export function isTrialActive(subscription: SubscriptionRecord, now = new Date()) {
  if (subscription.plan_type !== "founder_trial") {
    return false;
  }

  if (subscription.subscription_status !== "trialing") {
    return false;
  }

  if (!subscription.trial_ends_at) {
    return false;
  }

  return new Date(subscription.trial_ends_at).getTime() > now.getTime();
}

export function isTrialExpired(subscription: SubscriptionRecord, now = new Date()) {
  if (subscription.plan_type !== "founder_trial") {
    return subscription.subscription_status === "expired" || subscription.subscription_status === "canceled";
  }

  if (subscription.subscription_status === "expired" || subscription.subscription_status === "canceled") {
    return true;
  }

  if (!subscription.trial_ends_at) {
    return false;
  }

  return new Date(subscription.trial_ends_at).getTime() <= now.getTime();
}

/**
 * True when a failed-payment grace period has run out.
 *
 * The billing webhook keeps a `past_due` subscriber on `active` for a bounded
 * window and stamps `grace_period_ends_at`. Without this check that window would
 * never close and a failed card would mean permanent free access.
 */
export function isGracePeriodExpired(subscription: SubscriptionRecord, now = new Date()) {
  const endsAt = subscription.grace_period_ends_at;
  if (!endsAt) return false;
  return new Date(endsAt).getTime() <= now.getTime();
}

export function isSubscriptionActive(subscription: SubscriptionRecord, now = new Date()) {
  if (subscription.plan_type === "admin_internal") {
    return true;
  }

  // Checked before status: the webhook deliberately leaves a past_due
  // subscription reading "active" for the length of the grace period.
  if (isGracePeriodExpired(subscription, now)) {
    return false;
  }

  if (subscription.plan_type === "investor_free") {
    return subscription.subscription_status === "free" || subscription.subscription_status === "active";
  }

  if (subscription.plan_type === "founder_trial") {
    return isTrialActive(subscription, now) || !isTrialExpired(subscription, now);
  }

  return subscription.subscription_status === "active" || subscription.subscription_status === "trialing";
}

function featuresForPlan(planType: PlanType, subscription: SubscriptionRecord, now = new Date()): Set<FeatureKey> {
  if (planType === "admin_internal") {
    return new Set<FeatureKey>([
      ...FOUNDER_PROFESSIONAL_FEATURES,
      "investor_workspace",
    ]);
  }

  if (planType === "investor_free") {
    return new Set<FeatureKey>(["investor_workspace", "settings"]);
  }

  // New pricing model: Free gives ALL tools (CRR, valuation, data room, e-learning).
  // Paid tiers add distribution (investor identities, one-pager sends, limits,
  // brokered intros) — that gating is enforced separately (Phase 2), not by the
  // tool feature set here. Managed IR is done-for-you on top of Professional.
  if (
    planType === "founder_free" ||
    planType === "founder_professional" ||
    planType === "founder_managed_ir"
  ) {
    return new Set<FeatureKey>(FOUNDER_PROFESSIONAL_FEATURES);
  }

  if (planType === "founder_basic") {
    return new Set<FeatureKey>(FOUNDER_PROFESSIONAL_FEATURES);
  }

  // Legacy 3-day trial rows are grandfathered into permanent Free (all tools).
  if (planType === "founder_trial") {
    return new Set<FeatureKey>(FOUNDER_PROFESSIONAL_FEATURES);
  }

  return new Set<FeatureKey>(["settings"]);
}

export function canAccessFeature(
  subscription: SubscriptionRecord,
  featureKey: FeatureKey,
  now = new Date(),
): FeatureAccessResult {
  if (featureKey === "settings") {
    return { allowed: true, reason: null };
  }

  if (subscription.plan_type === "admin_internal") {
    return { allowed: true, reason: null };
  }

  if (subscription.plan_type === "investor_free") {
    if (featureKey === "investor_workspace") {
      return { allowed: true, reason: null };
    }

    return {
      allowed: false,
      reason: "This founder feature is not available on investor accounts.",
    };
  }

  const allowedFeatures = featuresForPlan(subscription.plan_type, subscription, now);

  if (allowedFeatures.has(featureKey)) {
    return { allowed: true, reason: null };
  }

  if (subscription.plan_type === "founder_trial" && isTrialExpired(subscription, now)) {
    return {
      allowed: false,
      reason: "Your tools are always free. Upgrade your plan when you're ready to raise capital — that reveals your matched investors and puts your materials in front of them.",
    };
  }

  if (subscription.plan_type === "founder_basic") {
    return {
      allowed: false,
      reason: "Upgrade to Professional for more distribution — up to 100 matched investors, brokered intros, and a monthly presentation slot.",
    };
  }

  if (subscription.subscription_status === "expired" || subscription.subscription_status === "canceled") {
    return {
      allowed: false,
      reason: "Your subscription is inactive. Upgrade to continue using this feature.",
    };
  }

  return {
    allowed: false,
    reason: "Upgrade your plan to access this feature.",
  };
}

export function requireFeatureAccess(
  subscription: SubscriptionRecord,
  featureKey: FeatureKey,
  now = new Date(),
): FeatureAccessResult {
  return canAccessFeature(subscription, featureKey, now);
}

export function getEffectivePlanType(subscription: SubscriptionRecord, now = new Date()): PlanType {
  if (subscription.plan_type === "founder_trial" && isTrialExpired(subscription, now)) {
    return "founder_trial";
  }

  return subscription.plan_type;
}

export function subscriptionStatusLabel(status: SubscriptionStatus) {
  switch (status) {
    case "trialing":
      return "Trialing";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "canceled":
      return "Canceled";
    case "free":
      return "Free";
    case "internal":
      return "Internal";
    default:
      return status;
  }
}

export function getFounderPathFeature(pathname: string): FeatureKey | null {
  if (pathname === "/founder/onboarding" || pathname.startsWith("/founder/onboarding/")) {
    return null;
  }

  if (pathname === "/founder/settings" || pathname.startsWith("/founder/settings/")) {
    return "settings";
  }

  if (pathname === "/founder" || pathname === "/founder/dashboard" || pathname.startsWith("/founder/dashboard/")) {
    return "dashboard";
  }

  if (pathname.startsWith("/founder/readiness") || pathname.startsWith("/founder/report")) {
    return "readiness";
  }

  if (pathname.startsWith("/founder/documents")) {
    return "documents";
  }

  if (pathname.startsWith("/founder/investors") || pathname.startsWith("/founder/messages")) {
    return "investor_access";
  }

  if (pathname.startsWith("/founder/capital-raise")) {
    return "capital_raise";
  }

  if (pathname.startsWith("/founder/learning")) {
    return "elearning";
  }

  if (pathname.startsWith("/founder/analytics")) {
    return "analytics";
  }

  return "dashboard";
}
