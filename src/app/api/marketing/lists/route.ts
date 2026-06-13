import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

export async function GET(): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const db = await marketingDb();
    const { data, error } = await db
      .from("marketing_lists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Attach contact counts
    const lists = await Promise.all(
      (data ?? []).map(async (list: { id: string; name: string; description: string | null; created_at: string; updated_at: string }) => {
        const { count } = await db
          .from("marketing_list_contacts")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        return { ...list, contact_count: count ?? 0 };
      })
    );
    return NextResponse.json(lists);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { name, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const db = await marketingDb();
    const { data, error } = await db
      .from("marketing_lists")
      .insert({ name: name.trim(), description: description?.trim() || null })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
