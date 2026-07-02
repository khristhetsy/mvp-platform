import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { assemblePlaybook } from "@/lib/playbook/assemble";

export const dynamic = "force-dynamic";

/** Assembled playbook (nav-joined editorial content) + drift report. Admin/analyst read. */
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    const playbook = await assemblePlaybook();
    return NextResponse.json(playbook);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load." }, { status: 500 });
  }
}
