/**
 * Assign (or clear) a campaign on existing posts. Staff-only.
 *   POST { postIds: string[], campaignId: string | null }
 * Counts roll into the campaign immediately; revenue only accrues from posts
 * published after assignment (their links then carry the campaign ?s= tag).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  postIds: z.array(z.string().uuid()).min(1).max(500),
  campaignId: z.string().uuid().nullable(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { error } = await db.from("social_posts")
    .update({ campaign_id: parsed.data.campaignId, updated_at: new Date().toISOString() })
    .in("id", parsed.data.postIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, assigned: parsed.data.postIds.length });
}
