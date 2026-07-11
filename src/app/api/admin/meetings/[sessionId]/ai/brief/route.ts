import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getCachedBrief, generateMeetingBrief } from "@/lib/meetings/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — latest cached brief (no generation).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  return NextResponse.json({ brief: await getCachedBrief(sessionId) });
}

// POST — generate (or refresh with ?force=1) the meeting brief.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    return NextResponse.json({ brief: await generateMeetingBrief(sessionId, { force, createdBy: profile.id }) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate brief." }, { status: 500 });
  }
}
