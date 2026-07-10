import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listSnapshots, getLatestSnapshot } from "@/lib/forecast/store";

export const dynamic = "force-dynamic";

// GET /api/sales/forecast/scenarios/[id]/snapshots — snapshot list (+ ?latest=1 for full output).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  if (req.nextUrl.searchParams.get("latest") === "1") {
    const latest = await getLatestSnapshot(id);
    return NextResponse.json({ snapshot: latest?.meta ?? null, output: latest?.output ?? null });
  }
  return NextResponse.json({ snapshots: await listSnapshots(id) });
}
