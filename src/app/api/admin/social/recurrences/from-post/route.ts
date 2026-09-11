/**
 * Create a recurrence seeded from an existing post. Staff-only.
 *   POST { postId, ...rule } → { id }
 * Reads the post + its variants (copy, comment, link, campaign, accounts) and starts a
 * repeating series from them — so any scheduled/published post can be made recurring.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createRecurrence, type RecurrenceRule } from "@/lib/social/recurrence";

export const dynamic = "force-dynamic";

const schema = z.object({
  postId: z.string().uuid(),
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(52),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  timeLocal: z.string().regex(/^\d{1,2}:\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endType: z.enum(["never", "on_date", "after"]),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endCount: z.number().int().min(1).max(500).nullable().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { data: post } = await db.from("social_posts")
    .select("body, comment_text, link_url, archetype, department, campaign_id").eq("id", d.postId).maybeSingle();
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const { data: vars } = await db.from("social_variants").select("account_id, body").eq("post_id", d.postId);
  const variants = ((vars ?? []) as { account_id: string; body: string }[]).map((v) => ({ accountId: v.account_id, body: v.body }));
  if (variants.length === 0) return NextResponse.json({ error: "This post has no accounts to repeat." }, { status: 400 });

  const rule: RecurrenceRule = { freq: d.freq, interval: d.interval, weekdays: d.weekdays, timeLocal: d.timeLocal, startDate: d.startDate, endType: d.endType, endDate: d.endDate ?? null, endCount: d.endCount ?? null };
  const res = await createRecurrence({
    ...rule,
    campaignId: post.campaign_id ?? null, archetype: post.archetype ?? null, department: post.department ?? null, brief: null,
    body: post.body ?? "", comment: post.comment_text ?? null, linkUrl: post.link_url ?? null, variants,
    createdBy: profile.id,
  });
  if (!res) return NextResponse.json({ error: "Could not create the series." }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
