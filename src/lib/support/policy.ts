/**
 * Customer Support Policy: the published reply promise and the plan limits table.
 *
 * The reply promise is a policy decision (2 business days, a target and not a
 * guarantee), so it is a constant here and not read from Support settings. The
 * Support settings reply target drives staff alerts and the due time on each
 * request; it can be tighter than this promise without changing what we publish.
 *
 * Plan limits are read from the same places the product enforces them
 * (founderEntitlements for matched investors, the founder connection config for
 * intro requests), so this page cannot drift from what founders are held to.
 */
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";
import type { FounderConnectionConfig } from "@/lib/settings/platform-settings";
import { SUPPORT_CLOSE_HOUR, SUPPORT_OPEN_HOUR } from "./business-hours";

/** Date of the published policy text. Bump it when the policy changes. */
export const SUPPORT_POLICY_VERSION_DATE = "2026-11-20";

export const SUPPORT_POLICY_REPLY_BUSINESS_DAYS = 2;
export const SUPPORT_POLICY_REPLY_PHRASE = `within ${SUPPORT_POLICY_REPLY_BUSINESS_DAYS} business days`;

/** "9:00 to 18:00" in support hours. */
export const SUPPORT_POLICY_HOURS = `${SUPPORT_OPEN_HOUR}:00 to ${SUPPORT_CLOSE_HOUR}:00 Pacific`;

export function formatPolicyDate(iso: string = SUPPORT_POLICY_VERSION_DATE): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type PlanLimitRow = { plan: string; matchedInvestors: string; introRequests: string };

const POLICY_PLANS: PlanType[] = ["founder_free", "founder_basic", "founder_professional", "founder_premium"];

function introText(plan: PlanType, cfg: FounderConnectionConfig): string {
  if (!founderEntitlements(plan).canBrokerIntros) return "Not included";
  const tier = plan === "founder_basic" ? "basic" : "professional";
  const month = cfg.monthlyByPlan[tier];
  const week = cfg.weeklyByPlan?.[tier] ?? null;
  return week === null ? `Up to ${month} per 30 days` : `Up to ${month} per 30 days, and ${week} per week`;
}

/** One row per founder plan, from the live entitlements and intro request caps. */
export function buildPlanLimitRows(cfg: FounderConnectionConfig): PlanLimitRow[] {
  return POLICY_PLANS.map((plan) => {
    const cap = founderEntitlements(plan).investorCap;
    return {
      plan: PLAN_LABELS[plan],
      matchedInvestors: cap === 0 ? "Not included" : cap === null ? "Uncapped" : `Up to ${cap}`,
      introRequests: introText(plan, cfg),
    };
  });
}
