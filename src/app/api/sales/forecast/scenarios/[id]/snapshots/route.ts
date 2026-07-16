import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listSnapshots, getLatestSnapshot } from "@/lib/forecast/store";
import { getSalesScope } from "@/lib/sales/scope";
import { forecastOwnerId } from "@/lib/sales/forecast-scope";

export const dynamic = "force-dynamic";

// GET /api/sales/forecast/scenarios/[id]/snapshots — snapshot list (+ ?latest=1 for full output).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const scope = await getSalesScope(profile);
  const ownerId = forecastOwnerId(scope, profile.id, req.nextUrl.searchParams.get("scope"));
  if (req.nextUrl.searchParams.get("latest") === "1") {
    const latest = await getLatestSnapshot(id, ownerId);
    return NextResponse.json({ snapshot: latest?.meta ?? null, output: latest?.output ?? null });
  }
  return NextResponse.json({ snapshots: await listSnapshots(id, ownerId) });
}
