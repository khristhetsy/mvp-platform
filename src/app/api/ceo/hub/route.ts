import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadCeoPayload } from "@/lib/ceo/hub-data";

export const dynamic = "force-dynamic";

// GET /api/ceo/hub — full CEO Hub read model (registry + snapshots + AI + recs + goals + brief).
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await loadCeoPayload());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
