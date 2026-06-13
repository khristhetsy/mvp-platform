import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

// PATCH /api/marketing/contacts/[id] — update tags, fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();
    const db = await marketingDb();
    const allowed = ["first_name", "last_name", "company", "title", "source", "tags", "metadata"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    const { data, error } = await db
      .from("marketing_contacts")
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

// GET /api/marketing/contacts/[id]/activity is in a separate route file
