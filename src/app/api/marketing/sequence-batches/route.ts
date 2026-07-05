import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getPendingBatches } from "@/lib/marketing/sequences";

export const dynamic = "force-dynamic";

// GET /api/marketing/sequence-batches — pending sequence batches awaiting approval.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    return NextResponse.json(await getPendingBatches());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
