import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listSnapshots } from "@/lib/meetings/lifecycle";

export const dynamic = "force-dynamic";

// GET — frozen KPI snapshots captured at meeting start.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  return NextResponse.json({ snapshots: await listSnapshots(sessionId) });
}
