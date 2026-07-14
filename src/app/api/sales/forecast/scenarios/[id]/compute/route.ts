import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { computeAndSnapshot } from "@/lib/forecast/store";
import { getSalesScope } from "@/lib/sales/scope";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/sales/forecast/scenarios/[id]/compute — run the engine and persist an
// immutable snapshot. (System journal entry is wired in batch B.)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const scope = await getSalesScope(profile);
  try {
    const { snapshotId, output, assumptionsHash } = await computeAndSnapshot(id, profile.id, scope.isManager ? null : scope.ownerId);
    return NextResponse.json({
      snapshotId,
      assumptionsHash,
      engineVersion: output.engineVersion,
      totals: output.totals,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Compute failed." }, { status: 500 });
  }
}
