import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listSuggestions } from "@/lib/meetings/ai";

export const dynamic = "force-dynamic";

// GET — pending AI task suggestions for this session.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  return NextResponse.json({ suggestions: await listSuggestions(sessionId) });
}
