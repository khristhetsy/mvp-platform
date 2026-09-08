import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ARCHETYPES, type Archetype } from "@/lib/social/composer";
import { syncPostEvent } from "@/lib/social/gcal-sync";

export const dynamic = "force-dynamic";

const schema = z.object({
  brief: z.string().max(4000).optional(),
  archetype: z.enum(ARCHETYPES.map((a) => a.key) as [Archetype, ...Archetype[]]),
  department: z.string().max(60).nullish(),
  linkUrl: z.string().url().max(500).nullish(),
  comment: z.string().max(1000).nullish(),
  approve: z.boolean().optional(),
  // ISO datetime. When present the post is scheduled (queued to publish at that time)
  // and mirrored to Google Calendar; when absent + approved it's parked (undated).
  scheduledAt: z.string().datetime().nullish(),
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
  const scheduledAt = parsed.data.scheduledAt ?? null;
  // Three landing states: scheduled (queued + dated), parked (approved, undated), draft.
  const variantStatus = scheduledAt ? "queued" : approved ? "parked" : "skipped";

  const { data: post, error: postErr } = await db.from("social_posts").insert({
    archetype: parsed.data.archetype,
    brief: parsed.data.brief ?? null,
    department: parsed.data.department ?? null,
    body: parsed.data.variants[0]?.body ?? "",
    comment_text: parsed.data.comment ?? null,
    link_url: parsed.data.linkUrl ?? null,
    status: scheduledAt ? "scheduled" : approved ? "approved" : "draft",
    created_by: profile.id,
  }).select("id").single();
  if (postErr || !post) return NextResponse.json({ error: postErr?.message ?? "Could not save post." }, { status: 400 });

  const rows = parsed.data.variants.map((v) => ({
    post_id: post.id,
    account_id: v.accountId,
    body: v.body,
    comment_text: parsed.data.comment ?? null,
    status: variantStatus,
    scheduled_at: scheduledAt,
    next_attempt_at: scheduledAt,   // cron publishes at/after this time
    idempotency_key: `${post.id}:${v.accountId}`,
  }));
  const { data: inserted, error: varErr } = await db.from("social_variants").insert(rows).select("id");
  if (varErr) return NextResponse.json({ error: varErr.message }, { status: 400 });

  // Mirror each scheduled variant onto the staff member's Google Calendar (best-effort).
  if (scheduledAt && Array.isArray(inserted)) {
    const title = (parsed.data.brief?.trim() || parsed.data.variants[0]?.body || "Social post").split("\n")[0].slice(0, 80);
    for (const row of inserted as { id: string }[]) {
      const eventId = await syncPostEvent({ userId: profile.id, existingEventId: null, title, startISO: scheduledAt, notes: parsed.data.variants[0]?.body ?? null });
      if (eventId) await db.from("social_variants").update({ gcal_event_id: eventId }).eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, postId: post.id, queued: scheduledAt ? rows.length : 0, parked: !scheduledAt && approved ? rows.length : 0 });
}
