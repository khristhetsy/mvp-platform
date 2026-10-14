import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FOUNDER_SOCIAL_PLANS, MASTER_ROW, listFounderSocialLimits, listFounderSocialUsage } from "@/lib/social/founder-limits";
import { logFounderSocialEvent } from "@/lib/social/activity";

export const dynamic = "force-dynamic";

// Admin, Feature controls, Founder social media: master switch, per plan access and
// monthly post limits, plus each founder's usage this cycle. Changes apply on the next
// founder request, no deploy.
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if (auth.error) return auth.error;
  try {
    const [limits, usage] = await Promise.all([listFounderSocialLimits(), listFounderSocialUsage()]);
    return NextResponse.json({ ...limits, usage });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load limits." }, { status: 500 });
  }
}

const schema = z.object({
  master: z.boolean(),
  plans: z.array(z.object({
    planType: z.enum(FOUNDER_SOCIAL_PLANS),
    enabled: z.boolean(),
    // null = unlimited
    postsPerMonth: z.number().int().min(0).max(100000).nullable(),
  })).min(1).max(FOUNDER_SOCIAL_PLANS.length),
});

export async function PUT(req: Request): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid limits." }, { status: 400 });

  try {
    const before = await listFounderSocialLimits();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    const now = new Date().toISOString();
    const rows = [
      { plan_type: MASTER_ROW, enabled: parsed.data.master, posts_per_month: null, updated_at: now, updated_by: auth.userId },
      ...parsed.data.plans.map((p) => ({ plan_type: p.planType, enabled: p.enabled, posts_per_month: p.postsPerMonth, updated_at: now, updated_by: auth.userId })),
    ];
    const { error } = await db.from("founder_social_limits").upsert(rows, { onConflict: "plan_type" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // One feed entry per changed plan (old limit to new limit), logged against the admin.
    for (const next of parsed.data.plans) {
      const old = before.plans.find((p) => p.planType === next.planType);
      if (old && old.postsPerMonth === next.postsPerMonth && old.enabled === next.enabled) continue;
      await logFounderSocialEvent({
        type: "admin.social_limits_changed",
        founderId: auth.userId,
        actorUserId: auth.userId,
        description: `${next.planType}: ${old?.postsPerMonth ?? "unlimited"} to ${next.postsPerMonth ?? "unlimited"} posts per month${old?.enabled === next.enabled ? "" : next.enabled ? ", access on" : ", access off"}`,
        metadata: { plan: next.planType, oldLimit: old?.postsPerMonth ?? null, newLimit: next.postsPerMonth, oldEnabled: old?.enabled ?? null, newEnabled: next.enabled },
      });
    }
    return NextResponse.json({ ok: true, ...(await listFounderSocialLimits()) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save limits." }, { status: 500 });
  }
}
