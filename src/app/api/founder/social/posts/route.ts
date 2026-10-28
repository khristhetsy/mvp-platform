import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, ownsAccounts, ownsCampaign, ownsPost, socialDb } from "@/lib/social/founder-auth";
import { getFounderSocialUsage } from "@/lib/social/founder-limits";
import { postsThatFit } from "@/lib/social/usage";
import { logFounderSocialEvent } from "@/lib/social/activity";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

const schema = z.object({
  // draft: saved, never counted. schedule / now: counted, needs room under the plan limit.
  // hold: a draft kept for the next cycle; a reminder goes out on the reset date, it never posts itself.
  mode: z.enum(["draft", "schedule", "now", "hold"]),
  title: z.string().max(120).nullish(),
  campaignId: z.string().uuid().nullish(),
  linkUrl: z.string().url().max(500).nullish(),
  imageUrl: z.string().url().max(1000).nullish(),
  comment: z.string().max(1000).nullish(),
  scheduledAt: z.string().datetime().nullish(),
  variants: z.array(z.object({ accountId: z.string().uuid(), body: z.string().min(1).max(4000) })).min(1).max(4),
});

// Create a founder post. One post sent to several networks is one row here, so it counts once.
// The founder choosing Schedule or Post now is the approval: no staff review step.
export async function POST(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid post." }, { status: 400 });
  const d = parsed.data;

  if (d.mode === "schedule" && !d.scheduledAt) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  if (!(await ownsAccounts(auth.founderId, d.variants.map((v) => v.accountId)))) {
    return NextResponse.json({ error: "Connect an account in Settings first." }, { status: 400 });
  }
  if (d.campaignId && !(await ownsCampaign(auth.founderId, d.campaignId))) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 400 });
  }

  // Server side limit check, fresh count. Drafts are never counted.
  const usage = await getFounderSocialUsage(auth.founderId);
  const counted = d.mode === "schedule" || d.mode === "now";
  if (counted && postsThatFit(usage.limit, usage.used, 1) < 1) {
    return NextResponse.json({ error: "Monthly post limit reached.", code: "limit_reached", usage }, { status: 403 });
  }

  const db = socialDb();
  const when = d.mode === "now" ? new Date().toISOString() : d.mode === "schedule" ? d.scheduledAt! : null;
  const held = d.mode === "hold";
  const { data: post, error: postErr } = await db.from("social_posts").insert({
    title: d.title ?? null,
    body: d.variants[0].body,
    comment_text: d.comment ?? null,
    link_url: d.linkUrl ?? null,
    image_url: d.imageUrl ?? null,
    campaign_id: d.campaignId ?? null,
    status: counted ? "scheduled" : "draft",
    scheduled_at: when,
    owner_profile_id: auth.founderId,
    held_until: held ? usage.resetAt : null,
    created_by: auth.founderId,
  }).select("id").single();
  if (postErr || !post) return NextResponse.json({ error: postErr?.message ?? "Could not save post." }, { status: 400 });

  const rows = d.variants.map((v) => ({
    post_id: post.id,
    account_id: v.accountId,
    body: v.body,
    comment_text: d.comment ?? null,
    status: counted ? "queued" : "skipped",
    scheduled_at: when,
    next_attempt_at: when,
    idempotency_key: `${post.id}:${v.accountId}`,
  }));
  const { error: varErr } = await db.from("social_variants").insert(rows);
  if (varErr) {
    await db.from("social_posts").delete().eq("id", post.id);
    return NextResponse.json({ error: varErr.message }, { status: 400 });
  }

  if (counted) {
    const { data: accts } = await db.from("social_accounts").select("platform").in("id", d.variants.map((v) => v.accountId));
    const networks = ((accts ?? []) as { platform: string }[]).map((a) => a.platform);
    await logFounderSocialEvent({
      type: "founder.social_post_scheduled", founderId: auth.founderId,
      description: `${d.title?.trim() || d.variants[0].body.slice(0, 60)} on ${networks.join(", ")}`,
      metadata: { postId: post.id, title: d.title ?? null, networks, campaignId: d.campaignId ?? null, scheduledAt: when },
    });
    const after = await getFounderSocialUsage(auth.founderId);
    if (after.state === "reached") {
      await logFounderSocialEvent({
        type: "founder.social_limit_reached", founderId: auth.founderId, dedupeKey: `founder_social_limit:${auth.founderId}:${after.cycleStart}`,
        description: `${after.planType} ${after.used} of ${after.limit}`, metadata: { plan: after.planType, limit: after.limit, resetAt: after.resetAt },
      });
    }
    return NextResponse.json({ ok: true, postId: post.id, usage: after });
  }
  return NextResponse.json({ ok: true, postId: post.id, usage, held });
}

// Move a scheduled post to a new time (drag and drop on the Schedule tab). Only posts that
// have not gone out yet. Moving a post does not change how many posts count this cycle.
export async function PATCH(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ postId: z.string().uuid(), scheduledAt: z.string().datetime() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid time." }, { status: 400 });
  const { postId, scheduledAt } = parsed.data;
  if (!(await ownsPost(auth.founderId, postId))) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (new Date(scheduledAt).getTime() < Date.now() + 60_000) return NextResponse.json({ error: "Pick a time in the future." }, { status: 400 });

  const db = socialDb();
  const { data: post } = await db.from("social_posts").select("id, status, held_until").eq("id", postId).maybeSingle();
  if (!post || post.status !== "scheduled" || post.held_until) return NextResponse.json({ error: "Only scheduled posts can be moved." }, { status: 400 });
  const { error: pe } = await db.from("social_posts").update({ scheduled_at: scheduledAt }).eq("id", postId).eq("owner_profile_id", auth.founderId);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 400 });
  // Only variants still waiting to go out move with it.
  await db.from("social_variants").update({ scheduled_at: scheduledAt, next_attempt_at: scheduledAt }).eq("post_id", postId).eq("status", "queued");
  await logFounderSocialEvent({ type: "founder.social_post_rescheduled", founderId: auth.founderId, description: `Moved to ${scheduledAt}`, metadata: { postId, scheduledAt } });
  return NextResponse.json({ ok: true });
}
