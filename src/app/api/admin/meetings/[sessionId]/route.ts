import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { setSessionStatus, deleteSession } from "@/lib/meetings/foundation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(["scheduled", "live", "closed"]) });

// PATCH — change a meeting session's status (mark live / closed / reopen).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
  try {
    await setSessionStatus(sessionId, parsed.data.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update." }, { status: 500 });
  }
}

// DELETE — permanently remove a meeting session and its entries/tasks (cascades).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  try {
    await deleteSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete." }, { status: 500 });
  }
}
