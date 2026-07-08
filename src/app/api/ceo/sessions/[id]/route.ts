import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateSession, deleteSession } from "@/lib/ceo/meetings";

export const dynamic = "force-dynamic";

const schema = z.object({
  attendance: z.string().max(120).nullable().optional(),
  note: z.string().max(6000).nullable().optional(),
  decisions: z.array(z.string().min(1).max(500)).max(30).optional(),
});

// PATCH — edit a journal entry.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await updateSession(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

// DELETE — remove a journal entry.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
