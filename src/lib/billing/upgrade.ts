import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  dashboard: "Founder dashboard",
  ai_diligence: "AI Due Diligence",
  documents: "Documents",
  readiness: "Readiness",
  investor_access: "Investor CRM",
  capital_raise: "Capital raise",
  elearning: "eLearning",
  analytics: "Analytics",
  premium_tools: "Premium tools",
  investor_workspace: "Investor workspace",
  settings: "Settings",
};

const PROFESSIONAL_FEATURES = new Set<FeatureKey>([
  "investor_access",
  "capital_raise",
  "elearning",
  "analytics",
  "premium_tools",
]);

export type UpgradeRequestType = "request_upgrade" | "contact_sales" | "notify_billing_live";

export function getFeatureLabel(featureKey: FeatureKey) {
  return FEATURE_LABELS[featureKey] ?? featureKey.replaceAll("_", " ");
}

export function parseUpgradeFeature(value: string | null | undefined): FeatureKey | null {
  if (!value) {
    return null;
  }

  if (value in FEATURE_LABELS) {
    return value as FeatureKey;
  }

  return null;
}

export function getUpgradeUrl(featureKey?: FeatureKey | null, planType?: PlanType | null) {
  const params = new URLSearchParams();

  if (featureKey) {
    params.set("feature", featureKey);
  }

  if (planType) {
    params.set("plan", planType);
  }

  const query = params.toString();
  return query ? `/upgrade?${query}` : "/upgrade";
}

export function getPlanUnlockingFeature(featureKey: FeatureKey): PlanType {
  if (PROFESSIONAL_FEATURES.has(featureKey)) {
    return "founder_professional";
  }

  return "founder_basic";
}

export function getFeatureLockCopy(featureKey: FeatureKey) {
  const label = getFeatureLabel(featureKey);
  const unlockingPlan = getPlanUnlockingFeature(featureKey);

  return {
    featureLabel: label,
    unlockingPlan,
    unlockingPlanLabel: PLAN_LABELS[unlockingPlan],
    headline: `${label} requires ${PLAN_LABELS[unlockingPlan]}`,
    description: `Upgrade to ${PLAN_LABELS[unlockingPlan]} to unlock ${label.toLowerCase()} and related founder workspace tools.`,
  };
}

export function parseUpgradePlan(value: string | null | undefined): PlanType | null {
  if (
    value === "founder_trial" ||
    value === "founder_basic" ||
    value === "founder_professional" ||
    value === "investor_free"
  ) {
    return value;
  }

  return null;
}

export function parseUpgradeRequestType(value: unknown): UpgradeRequestType | null {
  if (value === "request_upgrade" || value === "contact_sales" || value === "notify_billing_live") {
    return value;
  }

  return null;
}
