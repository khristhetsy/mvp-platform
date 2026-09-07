import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ARCHETYPES, type Archetype } from "@/lib/social/composer";

export const dynamic = "force-dynamic";

const schema = z.object({
  brief: z.string().max(4000).optional(),
  archetype: z.enum(ARCHETYPES.map((a) => a.key) as [Archetype, ...Archetype[]]),
  linkUrl: z.string().url().max(500).nullish(),
  comment: z.string().max(1000).nullish(),
  approve: z.boolean().optional(),
  variants: z.array(z.object({ accountId: z.string().uuid(), body: z.string().min(1).max(4000) })).min(1).max(6),
});

// Create a post + its per-account variants. Variants land 'queued' only when the
// post is approved (v1 rule: approve before publishing); otherwise the post stays
// a draft and its variants are held.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid post." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const approved = Boolean(parsed.data.approve);

  const { data: post, error: postErr } = await db.from("social_posts").insert({
    archetype: parsed.data.archetype,
    brief: parsed.data.brief ?? null,
    body: parsed.data.variants[0]?.body ?? "",
    comment_text: parsed.data.comment ?? null,
    link_url: parsed.data.linkUrl ?? null,
    status: approved ? "approved" : "draft",
    created_by: profile.id,
  }).select("id").single();
  if (postErr || !post) return NextResponse.json({ error: postErr?.message ?? "Could not save post." }, { status: 400 });

  const rows = parsed.data.variants.map((v) => ({
    post_id: post.id,
    account_id: v.accountId,
    body: v.body,
    comment_text: parsed.data.comment ?? null,
    status: approved ? "queued" : "skipped",   // held until approved
    idempotency_key: `${post.id}:${v.accountId}`,
  }));
  const { error: varErr } = await db.from("social_variants").insert(rows);
  if (varErr) return NextResponse.json({ error: varErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, postId: post.id, queued: approved ? rows.length : 0 });
}
