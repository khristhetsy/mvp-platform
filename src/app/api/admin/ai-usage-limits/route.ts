import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { AI_COST_FEATURES, LIMIT_PLANS, isAiCostFeature, type LimitPlan, type PlanLimit } from "@/lib/ai-usage";
import { getFeatureLimits, saveFeatureLimits } from "@/lib/ai-usage/service";

export const dynamic = "force-dynamic";

/** GET — merged (admin-override + default) limits for every paid AI feature. */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limits: Record<string, Record<LimitPlan, PlanLimit>> = {};
  for (const feature of AI_COST_FEATURES) {
    limits[feature] = await getFeatureLimits(feature, auth.supabase);
  }
  return NextResponse.json({ features: AI_COST_FEATURES, plans: LIMIT_PLANS, limits });
}

const planLimitSchema = z.object({
  maxRuns: z.number().int().min(0).max(10_000).nullable(),
  period: z.enum(["week", "month"]),
});

const putSchema = z.object({
  feature: z.string().refine(isAiCostFeature, "Not a paid AI feature"),
  limits: z.record(z.enum(LIMIT_PLANS), planLimitSchema),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Fill any missing plan with its current value so we always upsert a full set.
  const current = await getFeatureLimits(parsed.data.feature, auth.supabase);
  const next: Record<LimitPlan, PlanLimit> = { ...current };
  for (const plan of LIMIT_PLANS) {
    const incoming = parsed.data.limits[plan];
    if (incoming) next[plan] = { maxRuns: incoming.maxRuns, period: incoming.period };
  }

  const { error } = await saveFeatureLimits(parsed.data.feature, next, auth.supabase);
  if (error) return NextResponse.json({ error }, { status: 500 });

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.ai_usage_limits_updated",
    entityType: "ai_usage_limits",
    entityId: parsed.data.feature,
    metadata: { feature: parsed.data.feature, limits: next },
  });

  return NextResponse.json({ success: true, limits: next });
}
