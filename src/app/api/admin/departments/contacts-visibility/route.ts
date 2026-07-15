import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { setDepartmentContactsVisibility } from "@/lib/departments/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ departmentId: z.string().uuid(), seeAll: z.boolean() });

// POST /api/admin/departments/contacts-visibility — set a department's "see all contacts" flag.
export async function POST(req: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await setDepartmentContactsVisibility(parsed.data.departmentId, parsed.data.seeAll, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
