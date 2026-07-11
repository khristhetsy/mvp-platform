import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { journalDraft, journalPolish, journalPoints } from "@/lib/meetings/journal-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  mode: z.enum(["draft", "polish", "points"]),
  section_id: z.string().uuid().optional(),
  text: z.string().max(8000).optional(),
});

// POST — journal AI assist. Returns text/bullets into the draft buffer only; never writes rows.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode, section_id, text } = parsed.data;
  try {
    if (mode === "polish") return NextResponse.json({ text: await journalPolish(text ?? "") });
    if (!section_id) return NextResponse.json({ error: "section_id required." }, { status: 400 });
    if (mode === "draft") return NextResponse.json({ text: await journalDraft(sessionId, section_id) });
    return NextResponse.json({ points: await journalPoints(sessionId, section_id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI unavailable." }, { status: 500 });
  }
}
