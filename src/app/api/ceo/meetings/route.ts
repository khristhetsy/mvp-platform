import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadMeetings } from "@/lib/ceo/meetings";

export const dynamic = "force-dynamic";

// GET /api/ceo/meetings — meeting workflows + session journals.
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await loadMeetings());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
