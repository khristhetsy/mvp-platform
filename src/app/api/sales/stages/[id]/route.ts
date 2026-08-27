import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateStage, deleteStage } from "@/lib/sales/pipelines";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  sortOrder: z.number().int().optional(),
  isWon: z.boolean().optional(),
  sequenceId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateStage(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const reassignTo = new URL(req.url).searchParams.get("reassignTo");
  try {
    await deleteStage(id, reassignTo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Guard violations (last stage, only Won stage, bad target) are user-facing 400s.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 400 });
  }
}
