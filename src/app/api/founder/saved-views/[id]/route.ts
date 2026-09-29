/**
 * Delete one of the caller's own saved views. Owner-pinned, so a founder can only
 * ever delete their own — there is no admin escape hatch on this route.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  const { error } = await db
    .from("marketing_saved_searches")
    .delete()
    .eq("id", id)
    .eq("owner_id", auth.profile.id)
    .like("scope", "founder:%");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
