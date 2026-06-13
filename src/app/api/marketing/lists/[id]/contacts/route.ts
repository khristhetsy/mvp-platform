import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

// GET /api/marketing/lists/[id]/contacts — contacts in a list
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const db = await marketingDb();
    const { data, error } = await db
      .from("marketing_list_contacts")
      .select("contact_id, added_at, marketing_contacts(id,email,first_name,last_name,company,tags)")
      .eq("list_id", id)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/marketing/lists/[id]/contacts — add contacts to list
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const { contact_ids } = await req.json() as { contact_ids: string[] };
    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({ error: "contact_ids required" }, { status: 400 });
    }
    const db = await marketingDb();
    const rows = contact_ids.map((contact_id) => ({ list_id: id, contact_id }));
    const { error } = await db
      .from("marketing_list_contacts")
      .upsert(rows, { onConflict: "list_id,contact_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true, added: contact_ids.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/marketing/lists/[id]/contacts?contact_id=... — remove from list
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const contact_id = req.nextUrl.searchParams.get("contact_id");
    if (!contact_id) return NextResponse.json({ error: "contact_id required" }, { status: 400 });
    const db = await marketingDb();
    const { error } = await db
      .from("marketing_list_contacts")
      .delete()
      .eq("list_id", id)
      .eq("contact_id", contact_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
