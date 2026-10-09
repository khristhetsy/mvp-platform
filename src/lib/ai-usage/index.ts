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
export const AI_COST_FEATURES = [
  "pitch_deck_analyzer",
  "diligence_report",
  "valuation_advisor",
  "outreach_coach",
  "business_plan",
  "pitch_deck_draft",
  "regcf_documents",
  "intro_note_drafts",
  "class_assistant",
  "support_assistant",
  "watchlist_summary",
] as const;

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
  founder_managed_ir: "SPV Program",
};

/** Map any subscription plan to the bucket used for limit lookups. */
export function planBucket(plan: PlanType | null | undefined): LimitPlan {
  switch (plan) {
    case "founder_basic":
      return "founder_basic";
    case "founder_professional":
    case "founder_premium": // Premium uses Professional's caps
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
/** Starting caps; every one is editable in Admin, Feature Controls. SPV Program
 *  (which also covers internal staff accounts) stays unlimited, the dollar budget
 *  in Admin, Feature Controls, AI budget still applies to it. */
function caps(free: PlanLimit, basic: number, pro: number): Record<LimitPlan, PlanLimit> {
  return {
    founder_free: free,
    founder_basic: { maxRuns: basic, period: "month" },
    founder_professional: { maxRuns: pro, period: "month" },
    founder_managed_ir: { maxRuns: null, period: "month" },
  };
}
const ONE_A_WEEK: PlanLimit = { maxRuns: 1, period: "week" };

const DEFAULTS: Record<string, Record<LimitPlan, PlanLimit>> = {
  pitch_deck_analyzer: caps(ONE_A_WEEK, 10, 30),
  diligence_report: caps({ maxRuns: 1, period: "month" }, 2, 6),
  valuation_advisor: caps(ONE_A_WEEK, 10, 30),
  outreach_coach: caps(ONE_A_WEEK, 10, 30),
  intro_note_drafts: caps(ONE_A_WEEK, 10, 30),
  regcf_documents: caps(ONE_A_WEEK, 10, 30),
  // One run drafts one section or slide, so a full plan or deck takes several.
  business_plan: caps(ONE_A_WEEK, 30, 90),
  pitch_deck_draft: caps(ONE_A_WEEK, 30, 90),
  // Chat: one run is one message.
  class_assistant: caps({ maxRuns: 10, period: "week" }, 50, 150),
  support_assistant: caps({ maxRuns: 10, period: "week" }, 50, 150),
  // Investors are on the free side, so the Free row is the investor cap.
  watchlist_summary: caps({ maxRuns: 10, period: "month" }, 10, 30),
};

export function defaultLimits(feature: string): Record<LimitPlan, PlanLimit> {
  return DEFAULTS[feature] ?? UNLIMITED;
}
