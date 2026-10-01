// One call per route to apply the per-plan run cap to a paid AI tool, using the
// same limits table, enforcement and 429 response shape as the pitch deck analyzer.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { checkUsage, recordUsage } from "./service";

export type AiRunGate = {
  /** A 429 response to return when the plan's cap is reached; null when allowed. */
  blocked: Response | null;
  /** Count the run. Call once, only after the AI call succeeded. */
  done: () => Promise<void>;
};

export async function gateAiRun(profileId: string, feature: string): Promise<AiRunGate> {
  const admin = createServiceRoleClient();
  const plan = await getUserPlan(profileId).catch(() => null);
  const usage = await checkUsage({ profileId, plan, feature, admin });
  if (!usage.allowed) {
    return {
      blocked: NextResponse.json(
        {
          // Readable text in `error`, because these tools' screens show it as is.
          error: `You've used all ${usage.maxRuns} runs of this tool for this ${usage.period} on your plan.${usage.resetAt ? ` A new run opens ${new Date(usage.resetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : ""}`,
          code: "usage_limit_reached",
          limit: usage.maxRuns,
          period: usage.period,
          used: usage.used,
          resetAt: usage.resetAt,
        },
        { status: 429 },
      ),
      done: async () => {},
    };
  }
  return { blocked: null, done: () => recordUsage({ profileId, feature, admin }) };
}
