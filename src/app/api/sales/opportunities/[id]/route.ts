import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getOpportunity, updateOpportunity, deleteOpportunity } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  stageId: z.string().uuid().nullable().optional(),
  valueCents: z.number().int().min(0).nullable().optional(),
  billing: z.enum(["yearly", "monthly"]).optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  expectedClose: z.string().max(20).nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  source: z.string().max(80).nullable().optional(),
  leadStatus: z.string().max(80).nullable().optional(),
  status: z.enum(["open", "won", "lost", "archived"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

// GET /api/sales/opportunities/[id] — single opportunity for the detail page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ opportunity });
}

// PATCH /api/sales/opportunities/[id] — edit, mark sold (status=won), archive.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateOpportunity(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

// DELETE /api/sales/opportunities/[id] — permanently remove an opportunity.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  try {
    await deleteOpportunity(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
