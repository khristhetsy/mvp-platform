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

export function isSubscriptionActive(subscription: SubscriptionRecord, now = new Date()) {
  if (subscription.plan_type === "admin_internal") {
    return true;
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

  if (planType === "founder_professional") {
    return new Set<FeatureKey>(FOUNDER_PROFESSIONAL_FEATURES);
  }

  if (planType === "founder_basic") {
    return new Set<FeatureKey>(FOUNDER_BASIC_FEATURES);
  }

  if (planType === "founder_trial") {
    if (isTrialActive(subscription, now)) {
      return new Set<FeatureKey>(FOUNDER_PROFESSIONAL_FEATURES);
    }

    return new Set<FeatureKey>(FOUNDER_BASIC_FEATURES);
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
      reason: "Your free trial has expired. Upgrade to Professional to continue using premium founder features.",
    };
  }

  if (subscription.plan_type === "founder_basic") {
    return {
      allowed: false,
      reason: "Upgrade to Professional to access investor tools, capital raise, eLearning, and analytics.",
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

  if (pathname.startsWith("/founder/investors")) {
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
