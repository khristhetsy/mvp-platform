import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createSequence, updateSequenceStatus, deleteSequence } from "@/lib/marketing/sequences";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const { name } = await req.json();
    const seq = await createSequence(name, profile.id);
    return NextResponse.json(seq, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { sequence_id, status } = await req.json();
    await updateSequenceStatus(sequence_id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE ?sequence_id=… — permanently remove a sequence (steps/enrollments cascade).
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const sequenceId = req.nextUrl.searchParams.get("sequence_id");
    if (!sequenceId) return NextResponse.json({ error: "sequence_id is required." }, { status: 400 });
    await deleteSequence(sequenceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
