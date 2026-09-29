import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createSequence, updateSequenceStatus, deleteSequence, updateSequenceMeta, duplicateSequence, activeEnrollmentCount } from "@/lib/marketing/sequences";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const department = typeof body.department === "string" && body.department ? body.department : null;
    // { duplicate_of } → "Save as": copy that sequence's steps under the new name.
    const seq = body.duplicate_of
      ? await duplicateSequence(String(body.duplicate_of), name, profile.id, department)
      : await createSequence(name, profile.id, department);
    return NextResponse.json(seq, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { sequence_id, status, name, department } = await req.json();
    if (status) await updateSequenceStatus(sequence_id, status);
    if (name !== undefined || department !== undefined) await updateSequenceMeta(sequence_id, { name, department });
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
    // Contacts mid-sequence would silently stop receiving steps; make the caller archive instead.
    const active = await activeEnrollmentCount(sequenceId);
    if (active > 0) return NextResponse.json({ error: `${active} contact${active === 1 ? " is" : "s are"} still enrolled. Archive the sequence instead, or wait for them to finish.` }, { status: 409 });
    await deleteSequence(sequenceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
