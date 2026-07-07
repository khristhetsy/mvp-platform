import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listMembers, setMembership } from "@/lib/departments/admin";

export const dynamic = "force-dynamic";

// GET — internal users with their department memberships.
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ members: await listMembers() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

const schema = z.object({ userId: z.string().uuid(), departmentId: z.string().uuid(), member: z.boolean() });

// POST — add/remove a department membership.
export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await setMembership(parsed.data.userId, parsed.data.departmentId, parsed.data.member, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 400 });
  }
}
