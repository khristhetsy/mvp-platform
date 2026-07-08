import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { deleteOccurrence } from "@/lib/ceo/meetings";

export const dynamic = "force-dynamic";

// DELETE /api/ceo/occurrences/[id] — remove a one-off occurrence.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    await deleteOccurrence(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
