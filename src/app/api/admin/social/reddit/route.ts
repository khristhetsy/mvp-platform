/**
 * Reddit replies (manual channel) — staff-only.
 *   GET  → { campaigns, replies }  Reddit campaigns (rd_ tags) and recent replies with clicks
 *   POST { action: "campaign", name }                       → { campaign }
 *   POST { action: "draft", campaignId, threadUrl, body }   → { postId, trackedUrl }
 *   POST { action: "posted", postId, body }                 → { ok }
 *   POST { action: "discard", postId }                      → { ok }
 *
 * A reply is a social_posts row (no variants, so the publish queue never touches it).
 * Its tracked link is the existing /r/<post> redirect, which logs the click and forwards
 * to /fit?s=<rd_ tag>, so clicks, meetings and signups attribute with no new tables.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createCampaign } from "@/lib/social/campaigns";
import { originFromRequest } from "@/lib/social/request-origin";
import { REDDIT_FIT_URL, REDDIT_TAG_PREFIX, isRedditThreadUrl, threadLabel, type RedditCampaign, type RedditReply } from "@/lib/social/reddit";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

async function redditCampaigns(): Promise<RedditCampaign[]> {
  const { data } = await db().from("social_campaigns").select("id, name, source_tag")
    .is("archived_at", null).ilike("source_tag", `${REDDIT_TAG_PREFIX}\\_%`).order("created_at", { ascending: false });
  return (data ?? []) as RedditCampaign[];
}

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const campaigns = await redditCampaigns();
  const ids = campaigns.map((c) => c.id);
  let replies: RedditReply[] = [];
  if (ids.length) {
    const { data } = await db().from("social_posts")
      .select("id, brief, status, created_at, campaign:social_campaigns(name)")
      .in("campaign_id", ids).is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as Array<{ id: string; brief: string | null; status: string; created_at: string; campaign?: { name?: string | null } | null }>;
    const clicks = new Map<string, number>();
    if (rows.length) {
      const { data: c } = await db().from("social_clicks").select("post_id").in("post_id", rows.map((r) => r.id));
      for (const r of (c ?? []) as { post_id: string }[]) clicks.set(r.post_id, (clicks.get(r.post_id) ?? 0) + 1);
    }
    replies = rows.map((r) => ({
      id: r.id, thread: threadLabel(r.brief), thread_url: r.brief, status: r.status,
      campaign_name: r.campaign?.name ?? null, clicks: clicks.get(r.id) ?? 0, created_at: r.created_at,
    }));
  }
  return NextResponse.json({ campaigns, replies });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("campaign"), name: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal("draft"), campaignId: z.string().uuid(), threadUrl: z.string().trim().max(500), body: z.string().min(1).max(10000) }),
  z.object({ action: z.literal("posted"), postId: z.string().uuid(), body: z.string().min(1).max(10000) }),
  z.object({ action: z.literal("discard"), postId: z.string().uuid() }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = parsed.data;

  if (input.action === "campaign") {
    const campaign = await createCampaign(input.name, 0, profile.id, REDDIT_TAG_PREFIX);
    if (!campaign) return NextResponse.json({ error: "Could not create the campaign." }, { status: 400 });
    return NextResponse.json({ campaign });
  }

  if (input.action === "draft") {
    if (!isRedditThreadUrl(input.threadUrl)) return NextResponse.json({ error: "Paste a Reddit thread link (reddit.com/r/…/comments/…)." }, { status: 400 });
    const campaign = (await redditCampaigns()).find((c) => c.id === input.campaignId);
    if (!campaign) return NextResponse.json({ error: "Pick a Reddit campaign." }, { status: 400 });
    const { data, error } = await db().from("social_posts").insert({
      body: input.body, brief: input.threadUrl, link_url: REDDIT_FIT_URL, campaign_id: campaign.id,
      department: "Marketing", status: "draft", created_by: profile.id,
    }).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not save the reply." }, { status: 400 });
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || originFromRequest(req);
    return NextResponse.json({ postId: data.id, trackedUrl: `${base}/r/${data.id}` });
  }

  if (input.action === "posted") {
    const { data, error } = await db().from("social_posts")
      .update({ body: input.body, status: "published", updated_at: new Date().toISOString() })
      .eq("id", input.postId).select("id");
    const ok = !error && Array.isArray(data) && data.length > 0;
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  }

  // discard: soft-delete an unposted draft so it never clutters the Library.
  const { data, error } = await db().from("social_posts")
    .update({ deleted_at: new Date().toISOString() }).eq("id", input.postId).eq("status", "draft").select("id");
  const ok = !error && Array.isArray(data) && data.length > 0;
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
