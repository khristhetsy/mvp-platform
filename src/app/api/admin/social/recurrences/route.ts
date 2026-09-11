/**
 * Recurring posts. Staff-only.
 *   POST { dryRun?, ...rule, ...template } →
 *     dryRun → { upcoming: number[], total } (composer preview)
 *     else   → { id } (creates the series + materializes near-term occurrences)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createRecurrence, upcoming, totalCount, type RecurrenceRule } from "@/lib/social/recurrence";

export const dynamic = "force-dynamic";

const ruleSchema = {
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(52),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  timeLocal: z.string().regex(/^\d{1,2}:\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endType: z.enum(["never", "on_date", "after"]),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endCount: z.number().int().min(1).max(500).nullable().optional(),
};

const schema = z.object({
  ...ruleSchema,
  dryRun: z.boolean().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  archetype: z.string().max(40).nullable().optional(),
  department: z.string().max(60).nullable().optional(),
  brief: z.string().max(4000).nullable().optional(),
  body: z.string().max(4000).default(""),
  comment: z.string().max(1000).nullable().optional(),
  linkUrl: z.string().url().max(500).nullable().optional(),
  variants: z.array(z.object({ accountId: z.string().uuid(), body: z.string().min(1).max(4000) })).default([]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recurrence." }, { status: 400 });
  const d = parsed.data;
  const rule: RecurrenceRule = { freq: d.freq, interval: d.interval, weekdays: d.weekdays, timeLocal: d.timeLocal, startDate: d.startDate, endType: d.endType, endDate: d.endDate ?? null, endCount: d.endCount ?? null };

  if (d.dryRun) {
    return NextResponse.json({ upcoming: upcoming(rule, Date.now(), 6), total: totalCount(rule) });
  }
  if (d.variants.length === 0) return NextResponse.json({ error: "Draft the post first (no variants)." }, { status: 400 });
  const res = await createRecurrence({ ...rule, campaignId: d.campaignId ?? null, archetype: d.archetype ?? null, department: d.department ?? null, brief: d.brief ?? null, body: d.body, comment: d.comment ?? null, linkUrl: d.linkUrl ?? null, variants: d.variants, createdBy: profile.id });
  if (!res) return NextResponse.json({ error: "Could not create recurrence." }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
