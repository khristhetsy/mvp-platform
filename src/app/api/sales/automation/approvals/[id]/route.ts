import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { decideApproval } from "@/lib/sales/automation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ decision: z.enum(["approve", "keep"]) });

// POST /api/sales/automation/approvals/[id]: approve the move or keep the stage.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  try {
    const result = await decideApproval(id, parsed.data.decision, profile.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not save." }, { status: 500 });
  }
}
