import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { generateTaskSuggestions } from "@/lib/meetings/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — analyze the session's prep notes and add PENDING task suggestions (no real tasks created).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  try {
    return NextResponse.json(await generateTaskSuggestions(sessionId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate suggestions." }, { status: 500 });
  }
}
