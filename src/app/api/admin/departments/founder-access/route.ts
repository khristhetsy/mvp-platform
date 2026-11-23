import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { loadFounderAccess, saveFounderAccess } from "@/lib/departments/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  changes: z.array(z.object({ departmentId: z.string().uuid(), itemKey: z.string().min(1).max(200), enabled: z.boolean() })).min(1).max(5000),
});

// GET /api/admin/departments/founder-access: departments and the explicit Open as founder switches (admin only).
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await loadFounderAccess());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

// POST /api/admin/departments/founder-access: save switch changes (admin only).
export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await saveFounderAccess(parsed.data.changes, profile.id);
    return NextResponse.json({ ok: true, count: parsed.data.changes.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
