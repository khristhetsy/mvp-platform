/**
 * Change-alert rules. Staff-only.
 *   GET    → { rules }
 *   POST   { metric, direction, threshold_pct, grain, channel, campaign_id? } → { rule }
 *   PATCH  { id, ...patch } → { ok }
 *   DELETE { id } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from "@/lib/social/goals-io";

export const dynamic = "force-dynamic";

const base = {
  metric: z.enum(["outreach", "impressions", "clicks", "meetings", "conversions", "revenue", "goal_pacing"]),
  direction: z.enum(["up", "down", "behind_pace"]),
  threshold_pct: z.number().min(0).max(1000),
  grain: z.enum(["week", "month", "quarter", "year"]),
  channel: z.enum(["in_app", "email", "both"]),
  campaign_id: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
};

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ rules: await listAlertRules() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object(base).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid rule." }, { status: 400 });
  const rule = await createAlertRule({ ...parsed.data, campaign_id: parsed.data.campaign_id ?? null, enabled: parsed.data.enabled ?? true }, profile.id);
  if (!rule) return NextResponse.json({ error: "Could not create rule." }, { status: 400 });
  return NextResponse.json({ rule });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid() }).and(z.object(base).partial()).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid patch." }, { status: 400 });
  const { id, ...patch } = parsed.data;
  const ok = await updateAlertRule(id, patch);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const ok = await deleteAlertRule(parsed.data.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
