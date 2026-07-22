import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();
    const db = await marketingDb();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.description !== undefined) update.description = body.description?.trim() || null;
    const { data, error } = await db
      .from("marketing_lists")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const db = await marketingDb();
    // Campaigns reference the list without cascade — detach them first so the
    // delete doesn't fail on the FK (which would leave the "deleted" list showing).
    // Checked: if the detach fails, don't attempt the delete (it would fail on the
    // FK) and don't report success.
    const { error: detachError } = await db.from("marketing_campaigns").update({ list_id: null }).eq("list_id", id);
    if (detachError) throw detachError;
    const { error } = await db.from("marketing_lists").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
