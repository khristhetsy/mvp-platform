/**
 * Post lifecycle for the Library tab. Staff-only.
 *   POST { postId, action: "archive" | "unarchive" | "delete" | "restore" } → { ok }
 *
 * Archive hides a post from the Active library but keeps its history and stats.
 * Delete is a soft delete (deleted_at); the post's published variants and their
 * attributed metrics remain in reporting. Restore clears deleted_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ postId: z.string().uuid(), action: z.enum(["archive", "unarchive", "delete", "restore"]) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const now = new Date().toISOString();
  const patch =
    parsed.data.action === "archive" ? { archived_at: now }
    : parsed.data.action === "unarchive" ? { archived_at: null }
    : parsed.data.action === "delete" ? { deleted_at: now }
    : { deleted_at: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { error } = await db.from("social_posts").update({ ...patch, updated_at: now }).eq("id", parsed.data.postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
