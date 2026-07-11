import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listCarryover } from "@/lib/meetings/tasks";

export const dynamic = "force-dynamic";

// GET — open tasks carried over from prior sessions of the same meeting.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  return NextResponse.json({ tasks: await listCarryover(sessionId) });
}
