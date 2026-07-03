import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateVariant, deleteVariant } from "@/lib/voice/campaigns";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  openerScript: z.string().max(4000).nullish(),
  trafficWeight: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage campaigns." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await updateVariant(id, {
      label: parsed.data.label,
      openerScript: parsed.data.openerScript,
      trafficWeight: parsed.data.trafficWeight,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can manage campaigns." }, { status: 403 });
  const { id } = await params;
  try {
    await deleteVariant(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
