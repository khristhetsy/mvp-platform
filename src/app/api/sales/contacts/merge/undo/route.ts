/** POST /api/sales/contacts/merge/undo { batchId } — reverse one merge. Staff only. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { undoMerge } from "@/lib/sales/merge-contacts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = z.object({ batchId: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json(await undoMerge(parsed.data.batchId, profile.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const userFacing = /^(That merge|Another merge|Contact .* already exists)/.test(msg);
    return NextResponse.json({ error: userFacing ? msg : "Couldn't undo that merge." }, { status: userFacing ? 400 : 500 });
  }
}
