/** Delete a saved search the caller owns — or, for an admin, any shared one. Staff-only. */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  let q = db.from("marketing_saved_searches").delete().eq("id", id);
  q = profile.role === "admin" ? q.or(`owner_id.eq.${profile.id},is_shared.eq.true`) : q.eq("owner_id", profile.id);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
