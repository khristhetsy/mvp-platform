import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, ownsCampaign, socialDb } from "@/lib/social/founder-auth";
import { listAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from "@/lib/social/goals-io";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

const MAX_RULES = 20;
const base = {
  metric: z.enum(["outreach", "clicks", "meetings", "conversions", "goal_pacing"]),
  direction: z.enum(["up", "down", "behind_pace"]),
  threshold_pct: z.number().min(0).max(1000),
  grain: z.enum(["week", "month", "quarter", "year"]),
  channel: z.enum(["in_app", "email", "both"]),
  campaign_id: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
};

async function ownsRule(founderId: string, id: string): Promise<boolean> {
  const { data } = await socialDb().from("social_alert_rules").select("id").eq("id", id).eq("owner_profile_id", founderId).maybeSingle();
  return Boolean(data);
}

export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ rules: await listAlertRules(auth.founderId) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object(base).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid rule." }, { status: 400 });
  const d = parsed.data;
  if (d.campaign_id && !(await ownsCampaign(auth.founderId, d.campaign_id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if ((await listAlertRules(auth.founderId)).length >= MAX_RULES) return NextResponse.json({ error: `You can keep up to ${MAX_RULES} alert rules.` }, { status: 400 });
  const rule = await createAlertRule({ ...d, campaign_id: d.campaign_id ?? null, enabled: d.enabled ?? true }, auth.founderId, auth.founderId);
  if (!rule) return NextResponse.json({ error: "Could not create rule." }, { status: 400 });
  return NextResponse.json({ rule });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ id: z.string().uuid() }).and(z.object(base).partial()).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid change." }, { status: 400 });
  const { id, ...patch } = parsed.data;
  if (!(await ownsRule(auth.founderId, id))) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  if (patch.campaign_id && !(await ownsCampaign(auth.founderId, patch.campaign_id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const ok = await updateAlertRule(id, patch);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (!(await ownsRule(auth.founderId, parsed.data.id))) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  const ok = await deleteAlertRule(parsed.data.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
