import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { isFeatureEnabled, loadFeatureFlags } from "@/lib/feature-controls";
import { FOUNDER_PLANS, IR_AGENT_FEATURE_KEY, getAccessOverrides, getPlanAccess, getTemplate, setAccessOverride, setPlanAccess, setTemplate } from "@/lib/ir-agent/store";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { DEMO_SETTING_KEY, setDemoAgent } from "@/lib/ir-agent/marketing";
import { createServiceRoleClient, serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Everything the Founder IR Agent card in Feature Controls shows. */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = serviceRoleClientUntyped();
  const [flags, planRows, template, orgs, agents, overrides, demo] = await Promise.all([
    loadFeatureFlags(createServiceRoleClient()),
    getPlanAccess(),
    getTemplate(),
    db.from("organizations").select("id, name, purpose, created_at").eq("type", "founder").order("name").limit(500),
    db.from("ir_agents").select("id, organization_id, company_slug, ending, status, updated_at, compliance_acknowledged_at"),
    getAccessOverrides(),
    db.from("platform_settings").select("value").eq("key", DEMO_SETTING_KEY).maybeSingle(),
  ]);
  const byOrg = new Map<string, { company_slug: string; ending: string; status: string; updated_at: string; compliance_acknowledged_at: string | null }>();
  for (const a of (agents.data ?? []) as Array<{ organization_id: string; company_slug: string; ending: string; status: string; updated_at: string; compliance_acknowledged_at: string | null }>) byOrg.set(a.organization_id, a);
  const planMap = new Map(planRows.map((r) => [r.plan_type, r.enabled]));

  const liveAgents = ((agents.data ?? []) as Array<{ company_slug: string; status: string; organization_id: string }>)
    .filter((a) => a.status === "live")
    .map((a) => ({ slug: a.company_slug, label: (orgs.data ?? []).find((o: { id: string }) => o.id === a.organization_id)?.name ?? a.company_slug }));
  return NextResponse.json({
    enabled: isFeatureEnabled(flags, "founder", IR_AGENT_FEATURE_KEY),
    demoSlug: (demo.data as { value?: { slug?: string | null } } | null)?.value?.slug ?? null,
    liveAgents,
    plans: FOUNDER_PLANS.map((p) => ({ plan_type: p, label: PLAN_LABELS[p], enabled: planMap.get(p) ?? false })),
    template,
    founders: ((orgs.data ?? []) as Array<{ id: string; name: string; purpose: string | null }>).map((o) => ({
      id: o.id,
      name: o.name,
      purpose: o.purpose,
      override: overrides.get(o.id) ?? null,
      agent: byOrg.get(o.id) ?? null,
    })),
  });
}

const putSchema = z.object({
  enabled: z.boolean().optional(),
  plans: z.array(z.object({ plan_type: z.enum(FOUNDER_PLANS), enabled: z.boolean() })).optional(),
  overrides: z.array(z.object({ orgId: z.string().uuid(), override: z.enum(["allow", "deny"]).nullable() })).max(200).optional(),
  template: z.unknown().optional(),
  /** The live agent shown as "Talk to a demo agent" on the pricing page. Null clears it. */
  demoSlug: z.string().max(40).nullable().optional(),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { enabled, plans, overrides, template, demoSlug } = parsed.data;
  const db = serviceRoleClientUntyped();

  if (enabled !== undefined) {
    const { error } = await db
      .from("feature_flags")
      .upsert({ audience: "founder", feature: IR_AGENT_FEATURE_KEY, enabled, updated_at: new Date().toISOString() }, { onConflict: "audience,feature" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (plans) {
    const ok = await setPlanAccess(plans);
    if (!ok) return NextResponse.json({ error: "Could not save plan access." }, { status: 500 });
  }
  if (overrides) {
    for (const o of overrides) {
      if (!(await setAccessOverride(o.orgId, o.override, auth.userId))) return NextResponse.json({ error: "Could not save the override." }, { status: 500 });
    }
  }
  if (demoSlug !== undefined) {
    if (!(await setDemoAgent(demoSlug, auth.userId))) return NextResponse.json({ error: "Could not save the demo agent." }, { status: 500 });
  }
  let savedTemplate = null;
  if (template !== undefined) {
    savedTemplate = await setTemplate(template, auth.userId);
    if (!savedTemplate) return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
  }

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.ir_agent_controls_updated",
    entityType: "platform_settings",
    entityId: "ir_agent",
    metadata: { enabled, plans, overrides: overrides?.length ?? 0, template: template !== undefined, demoSlug },
  });

  return NextResponse.json({ success: true, template: savedTemplate });
}
