import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { startMeeting } from "@/lib/meetings/lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — start the meeting (live + freeze KPI snapshots). CEO/Admin only.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Only the CEO/Admin can start the meeting." }, { status: 403 });
  const { sessionId } = await params;
  try {
    return NextResponse.json(await startMeeting(sessionId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start meeting." }, { status: 500 });
  }
}
