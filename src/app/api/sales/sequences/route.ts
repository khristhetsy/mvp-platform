import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSequences } from "@/lib/marketing/sequences";

export const dynamic = "force-dynamic";

// GET /api/sales/sequences — lightweight list of marketing sequences for the
// Sales Hub pickers (per-stage mapping + manual enroll). Returns { id, name, status }.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const sequences = await getSequences().catch(() => []);
  return NextResponse.json({
    sequences: sequences.map((s) => ({ id: s.id, name: s.name, status: s.status })),
  });
}
