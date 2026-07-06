import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

type Body =
  | { action: "add_to_list"; ids: string[]; list_id: string }
  | { action: "tag"; ids: string[]; tag: string }
  | { action: "delete"; ids: string[] };

// POST /api/marketing/contacts/bulk — bulk actions on selected contacts.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const body = (await req.json()) as Body;
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) return NextResponse.json({ error: "No contacts selected." }, { status: 400 });
    const db = await marketingDb();

    if (body.action === "add_to_list") {
      if (!body.list_id) return NextResponse.json({ error: "A list is required." }, { status: 400 });
      const rows = ids.map((contact_id) => ({ list_id: body.list_id, contact_id }));
      const { error } = await db.from("marketing_list_contacts").upsert(rows, { onConflict: "list_id,contact_id" });
      if (error) throw error;
      return NextResponse.json({ ok: true, count: ids.length });
    }

    if (body.action === "tag") {
      const clean = body.tag?.trim().toLowerCase().replace(/\s+/g, "-");
      if (!clean) return NextResponse.json({ error: "A tag is required." }, { status: 400 });
      const { data } = await db.from("marketing_contacts").select("id, tags").in("id", ids);
      const current = (data ?? []) as { id: string; tags: string[] | null }[];
      await Promise.all(current.map((c) => {
        const next = [...new Set([...(c.tags ?? []), clean])];
        return db.from("marketing_contacts").update({ tags: next }).eq("id", c.id);
      }));
      return NextResponse.json({ ok: true, count: current.length });
    }

    if (body.action === "delete") {
      await db.from("marketing_list_contacts").delete().in("contact_id", ids);
      const { error } = await db.from("marketing_contacts").delete().in("id", ids);
      if (error) throw error;
      return NextResponse.json({ ok: true, count: ids.length });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
