import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { upsertCondition, deleteCondition } from "@/lib/diligence/dataroom";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(300).optional(),
  detail: z.string().max(3000).nullish(),
  status: z.enum(["not_started", "in_progress", "done"]).optional(),
  sort_order: z.number().int().nullish(),
});

/** POST — create or update a condition. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid condition." }, { status: 400 });

  try {
    const condition = await upsertCondition(auth.supabase, id, auth.userId, parsed.data);
    return NextResponse.json({ condition });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

const deleteSchema = z.object({ conditionId: z.string().uuid() });

/** DELETE — remove a condition. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "conditionId required." }, { status: 400 });

  try {
    await deleteCondition(auth.supabase, id, auth.userId, parsed.data.conditionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
