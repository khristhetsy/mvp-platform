/**
 * "Post here too": queue an existing post for one more connected account. Staff-only.
 *   POST { postId, accountId } → { ok, variantId }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { addAccountToPost } from "@/lib/social/post-accounts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object({ postId: z.string().uuid(), accountId: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const r = await addAccountToPost(parsed.data.postId, parsed.data.accountId);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
}
