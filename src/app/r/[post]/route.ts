/**
 * Public click redirect: /r/<postId>
 * Logs a click (social_clicks) then 302s to the post's real destination with the
 * campaign ?s= tag intact, so /fit attribution is unchanged. Never blocks the
 * redirect on the logging write.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { taggedLink } from "@/lib/social/queue";

export const dynamic = "force-dynamic";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://icapos.com";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ post: string }> }): Promise<Response> {
  const { post: postId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return NextResponse.redirect(appUrl(), 302);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { data: post } = await db.from("social_posts")
    .select("id, link_url, campaign_id, campaign:social_campaigns(source_tag)")
    .eq("id", postId).maybeSingle();

  const p = post as { id: string; link_url: string | null; campaign_id: string | null; campaign?: { source_tag: string | null } | null } | null;
  const sourceTag = p?.campaign?.source_tag ?? null;
  const dest = taggedLink(p?.link_url ?? null, sourceTag) ?? appUrl();

  // Best-effort log — must not block the redirect.
  if (p) {
    try {
      await db.from("social_clicks").insert({
        post_id: p.id, campaign_id: p.campaign_id, source_tag: sourceTag,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      });
    } catch { /* ignore */ }
  }
  return NextResponse.redirect(dest, 302);
}
