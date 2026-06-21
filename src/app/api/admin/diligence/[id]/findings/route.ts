import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { upsertFinding, deleteFinding } from "@/lib/diligence/data";

export const dynamic = "force-dynamic";

const findingSchema = z.object({
  id: z.string().uuid().optional(),
  domain_id: z.string().uuid().nullish(),
  title: z.string().min(1).max(300).optional(),
  detail: z.string().max(5000).nullish(),
  severity: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["open", "mitigating", "resolved"]).optional(),
  verification: z.enum(["unverified", "requested", "submitted", "verified", "discrepancy"]).optional(),
  source: z.string().max(300).nullish(),
  internal_note: z.string().max(5000).nullish(),
});

/** POST — create or update a finding. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = findingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid finding." }, { status: 400 });

  try {
    const finding = await upsertFinding(auth.supabase, id, auth.userId, parsed.data);
    return NextResponse.json({ finding });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

const deleteSchema = z.object({ findingId: z.string().uuid() });

/** DELETE — remove a finding. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "findingId required." }, { status: 400 });

  try {
    await deleteFinding(auth.supabase, id, auth.userId, parsed.data.findingId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
