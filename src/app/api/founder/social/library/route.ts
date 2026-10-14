import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, ownsPost, socialDb } from "@/lib/social/founder-auth";

export const dynamic = "force-dynamic";

// The founder's own posts: drafts, held drafts, scheduled and published, newest first.
export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const { data, error } = await socialDb().from("social_posts")
    .select("id, title, body, status, scheduled_at, held_until, archived_at, created_at, campaign:social_campaigns(name), variants:social_variants(status, account:social_accounts(platform))")
    .eq("owner_profile_id", auth.founderId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

// Archive or delete a post. Published posts stay on the network; this only removes them from the library.
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ postId: z.string().uuid(), action: z.enum(["archive", "unarchive", "delete"]) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!(await ownsPost(auth.founderId, parsed.data.postId))) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const now = new Date().toISOString();
  const patch = parsed.data.action === "archive" ? { archived_at: now } : parsed.data.action === "unarchive" ? { archived_at: null } : { deleted_at: now };
  const { error } = await socialDb().from("social_posts").update({ ...patch, updated_at: now }).eq("id", parsed.data.postId).eq("owner_profile_id", auth.founderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (parsed.data.action === "delete") {
    // Cancel anything still waiting to go out.
    await socialDb().from("social_variants").update({ status: "skipped", updated_at: now }).eq("post_id", parsed.data.postId).in("status", ["queued", "parked"]);
  }
  return NextResponse.json({ ok: true });
}
