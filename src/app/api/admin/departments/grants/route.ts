import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { batchUpsertGrants } from "@/lib/departments/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  grants: z.array(z.object({ departmentId: z.string().uuid(), featureId: z.string().uuid(), enabled: z.boolean() })).min(1).max(2000),
});

// POST /api/admin/departments/grants — batch upsert grants (admin-only).
export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await batchUpsertGrants(parsed.data.grants, profile.id);
    return NextResponse.json({ ok: true, count: parsed.data.grants.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
