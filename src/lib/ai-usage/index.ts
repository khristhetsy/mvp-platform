import type { PlanType } from "@/lib/subscriptions/plans";

// Pure config + types for AI usage limits. Safe to import from client components
// (no server-only deps). The enforcement/DB logic lives in ./service (server-only).

export type UsagePeriod = "week" | "month";
/** A per-plan cap. maxRuns === null means unlimited. */
export type PlanLimit = { maxRuns: number | null; period: UsagePeriod };

/**
 * Feature keys (from the feature-controls registry) whose runs make a PAID
 * Anthropic API call. Only these show a usage-limit editor and get enforced.
 * Add a key here (and a DEFAULTS entry below) to cap another paid tool.
 */
export const AI_COST_FEATURES = ["pitch_deck_analyzer"] as const;

export function isAiCostFeature(feature: string): boolean {
  return (AI_COST_FEATURES as readonly string[]).includes(feature);
}

/** Plan buckets we expose caps for. Free/trial/investor/null collapse to Free. */
export const LIMIT_PLANS = [
  "founder_free",
  "founder_basic",
  "founder_professional",
  "founder_managed_ir",
] as const;
export type LimitPlan = (typeof LIMIT_PLANS)[number];

export const PLAN_LABELS: Record<LimitPlan, string> = {
  founder_free: "Free",
  founder_basic: "Basic",
  founder_professional: "Professional",
  founder_managed_ir: "Managed IR",
};

/** Map any subscription plan to the bucket used for limit lookups. */
export function planBucket(plan: PlanType | null | undefined): LimitPlan {
  switch (plan) {
    case "founder_basic":
      return "founder_basic";
    case "founder_professional":
      return "founder_professional";
    case "founder_managed_ir":
    case "admin_internal":
      return "founder_managed_ir";
    default:
      return "founder_free"; // founder_free, founder_trial, investor_*, null
  }
}

const UNLIMITED: Record<LimitPlan, PlanLimit> = {
  founder_free: { maxRuns: null, period: "week" },
  founder_basic: { maxRuns: null, period: "month" },
  founder_professional: { maxRuns: null, period: "month" },
  founder_managed_ir: { maxRuns: null, period: "month" },
};

/** Code defaults per feature. Admin overrides in ai_usage_limits win over these. */
const DEFAULTS: Record<string, Record<LimitPlan, PlanLimit>> = {
  pitch_deck_analyzer: {
    founder_free: { maxRuns: 1, period: "week" },
    founder_basic: { maxRuns: 10, period: "month" },
    founder_professional: { maxRuns: null, period: "month" },
    founder_managed_ir: { maxRuns: null, period: "month" },
  },
};

export function defaultLimits(feature: string): Record<LimitPlan, PlanLimit> {
  return DEFAULTS[feature] ?? UNLIMITED;
}
