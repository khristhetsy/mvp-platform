import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { enrollContact } from "@/lib/marketing/sequences";

// POST /api/marketing/contacts/[id]/enroll — enroll this contact into a sequence.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const { sequence_id } = (await req.json()) as { sequence_id?: string };
    if (!sequence_id) return NextResponse.json({ error: "A sequence is required." }, { status: 400 });
    await enrollContact(sequence_id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
