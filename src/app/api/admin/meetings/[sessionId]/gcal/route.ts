import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { pushSessionToGoogle } from "@/lib/meetings/gcal";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST — push this meeting session to Google Calendar and capture the Meet link.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  try {
    const result = await pushSessionToGoogle(sessionId, profile.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to push to Google." }, { status: 500 });
  }
}
