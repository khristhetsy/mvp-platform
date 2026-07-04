import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createContact, deleteContact, getContacts } from "@/lib/marketing/contacts";

// GET /api/marketing/contacts?search=… — search contacts (for adding to lists).
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const { contacts } = await getContacts({ search, limit: 20 });
    return NextResponse.json(contacts);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    if (!body.email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const contact = await createContact(body);
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
