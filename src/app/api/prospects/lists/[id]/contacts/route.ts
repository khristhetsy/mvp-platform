import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getListApproachRows } from "@/lib/prospects/saved-lists";
import { buildApproachAdvice } from "@/lib/approach/advice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/prospects/lists/[id]/contacts — a list's contacts with approach data + advice.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  try {
    const rows = await getListApproachRows(id);
    const withAdvice = rows.map((r) => ({ ...r, advice: buildApproachAdvice({ side: r.side, segment: r.segment, approach: r.approach }) }));
    return NextResponse.json({ rows: withAdvice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
