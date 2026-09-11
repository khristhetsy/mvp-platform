/**
 * Duplicate a post into one or more campaigns. Staff-only.
 *   POST { postId, campaignIds: string[] } → { created: [{postId, campaignId}] }
 *
 * Each clone is a fresh social_posts row under the target campaign, copying the body,
 * comment, link, archetype, brief and department, plus a draft variant per account of
 * the source. Clones land as drafts (undated) so they appear on the schedule for review;
 * when published, each carries its own campaign source_tag via the queue's taggedLink.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  postId: z.string().uuid(),
  campaignIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { data: src } = await db.from("social_posts")
    .select("body, comment_text, link_url, archetype, brief, department").eq("id", parsed.data.postId).maybeSingle();
  if (!src) return NextResponse.json({ error: "Source post not found." }, { status: 404 });
  const { data: srcVars } = await db.from("social_variants").select("account_id, body, comment_text").eq("post_id", parsed.data.postId);
  const variants = (srcVars ?? []) as { account_id: string; body: string; comment_text: string | null }[];

  const created: { postId: string; campaignId: string }[] = [];
  for (const campaignId of parsed.data.campaignIds) {
    const { data: post, error } = await db.from("social_posts").insert({
      body: src.body ?? "", comment_text: src.comment_text ?? null, link_url: src.link_url ?? null,
      archetype: src.archetype ?? null, brief: src.brief ?? null, department: src.department ?? null,
      campaign_id: campaignId, status: "draft", created_by: profile.id,
    }).select("id").single();
    if (error || !post) continue;
    if (variants.length) {
      await db.from("social_variants").insert(variants.map((v) => ({
        post_id: post.id, account_id: v.account_id, body: v.body, comment_text: v.comment_text,
        status: "skipped", idempotency_key: `${post.id}:${v.account_id}`,
      })));
    }
    created.push({ postId: post.id, campaignId });
  }
  return NextResponse.json({ ok: true, created });
}
