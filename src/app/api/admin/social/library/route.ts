/**
 * Library — reusable posts with light stats, for the Library tab. Staff-only.
 *   GET ?scope=active|archived → { posts }
 *
 * Excludes soft-deleted posts. `published` counts published variants; `top` flags the
 * strongest posts by publish count so the UI can surface them for one-click reuse.
 * (Per-post click tracking arrives with the /r/<post> redirect; not included here.)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type LibraryPost = {
  id: string; body: string; archetype: string | null; campaign_id: string | null; campaign_name: string | null;
  archived: boolean; published: number; clicks: number; created_at: string | null; top: boolean;
};

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const scope = new URL(req.url).searchParams.get("scope") === "archived" ? "archived" : "active";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  let q = db.from("social_posts")
    .select("id, body, archetype, created_at, archived_at, campaign:social_campaigns(id, name)")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(300);
  q = scope === "archived" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data } = await q;
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const ids = rows.map((r) => String(r.id));
  const publishedByPost = new Map<string, number>();
  const clicksByPost = new Map<string, number>();
  if (ids.length) {
    const [{ data: vars }, { data: clicks }] = await Promise.all([
      db.from("social_variants").select("post_id").eq("status", "published").in("post_id", ids),
      db.from("social_clicks").select("post_id").in("post_id", ids).limit(200000),
    ]);
    for (const v of (vars ?? []) as { post_id: string }[]) publishedByPost.set(v.post_id, (publishedByPost.get(v.post_id) ?? 0) + 1);
    for (const c of (clicks ?? []) as { post_id: string | null }[]) if (c.post_id) clicksByPost.set(c.post_id, (clicksByPost.get(c.post_id) ?? 0) + 1);
  }
  // Rank "top" by clicks when we have any, else by publish count.
  const maxClicks = Math.max(0, ...clicksByPost.values());
  const maxPub = Math.max(1, ...publishedByPost.values());

  const posts: LibraryPost[] = rows.map((r) => {
    const c = r.campaign as { id?: string; name?: string } | null;
    const published = publishedByPost.get(String(r.id)) ?? 0;
    const clicks = clicksByPost.get(String(r.id)) ?? 0;
    const top = maxClicks > 0 ? clicks >= maxClicks * 0.6 && clicks > 0 : published > 0 && published >= maxPub * 0.6;
    return {
      id: String(r.id), body: String(r.body ?? ""), archetype: (r.archetype as string) ?? null,
      campaign_id: c?.id ?? null, campaign_name: c?.name ?? null,
      archived: Boolean(r.archived_at), published, clicks, created_at: (r.created_at as string) ?? null, top,
    };
  });
  return NextResponse.json({ posts });
}
