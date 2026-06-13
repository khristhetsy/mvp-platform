import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createSequence, updateSequenceStatus } from "@/lib/marketing/sequences";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { name } = await req.json();
    const seq = await createSequence(name);
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
